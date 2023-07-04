import { Builder, Cell as TonCell } from 'ton-core';
import type { Method } from 'tonweb';
import TonWeb from 'tonweb';
import type { Cell } from 'tonweb/dist/types/boc/cell';
import type { WalletContract } from 'tonweb/dist/types/contract/wallet/wallet-contract';
import type { Transaction as RawTransaction } from 'tonapi-sdk-js/dist/models/Transaction';

import {
  ApiTransactionDraftError, ApiTransactionError,
} from '../../types';
import type { Storage } from '../../storages/types';
import type {
  ApiNetwork,
  ApiParsedPayload,
  ApiSignedTransfer,
  ApiTransaction,
  ApiTxIdBySlug,
} from '../../types';
import type {
  ApiTransactionExtra, TonTransferParams,
} from './types';

import { TON_TOKEN_SLUG } from '../../../config';
import { parseAccountId } from '../../../util/account';
import { omit } from '../../../util/iteratees';
import { logDebugError } from '../../../util/logs';
import { pause } from '../../../util/schedulers';
import { stringifyTxId } from './util';
import { decryptMessageComment, encryptMessageComment } from './util/encryption';
import { parseTransactionBody, toBounceableAddress } from './util/metadata';
import { fetchAccountTransactions, fetchNftItems } from './util/tonapiio';
import { getTonClient, getTonWalletContract } from './util/tonCore';
import { fetchNewestTxId, getWalletPublicKey, toBase64Address } from './util/tonweb';
import { fetchStoredAccount, fetchStoredAddress, fetchStoredPublicKey } from '../../common/accounts';
import { getAddressInfo } from '../../common/addresses';
import {
  compareTransactions, updateTransactionMetadata,
} from '../../common/helpers';
import {
  base64ToBytes, hexToBase64, isKnownStakingPool,
} from '../../common/utils';
import { resolveAddress } from './address';
import { fetchKeyPair, fetchPrivateKey } from './auth';
import {
  ATTEMPTS,
  JettonOpCode,
  NftOpCode,
  STAKE_COMMENT,
  UNSTAKE_COMMENT,
} from './constants';
import type { JettonWalletType } from './tokens';
import {
  buildTokenSlug,
  buildTokenTransfer,
  getTokenWalletBalance,
  parseTokenTransaction,
  resolveTokenBySlug,
  resolveTokenMinterAddress,
  resolveTokenWalletAddress,
} from './tokens';
import {
  getWalletBalance, getWalletInfo, isWalletInitialized, pickAccountWallet,
} from './wallet';

type SubmitTransferResult = {
  resolvedAddress: string;
  amount: string;
  seqno: number;
  encryptedComment?: string;
} | {
  error: string;
};

type SubmitMultiTransferResult = {
  messages: (TonTransferParams & {
    resolvedAddress: string;
  })[];
  amount: string;
  seqno: number;
} | {
  error: string;
};

const { Address, fromNano } = TonWeb.utils;

const DEFAULT_FEE = '10966001';
const DEFAULT_EXPIRE_AT_TIMEOUT_SEC = 60; // 60 sec.
const GET_TRANSACTIONS_LIMIT = 50;
const GET_TRANSACTIONS_MAX_LIMIT = 1000;
const DATA_TEXT_PREFIX = [0, 0, 0, 0].toString();
const WAIT_SEQNO_TIMEOUT = 40000; // 40 sec.
const WAIT_SEQNO_PAUSE = 5000; // 5 sec.

const lastTransfers: Record<ApiNetwork, Record<string, {
  timestamp: number;
  seqno: number;
}>> = {
  mainnet: {},
  testnet: {},
};

export async function checkTransactionDraft(
  storage: Storage,
  accountId: string,
  tokenSlug: string,
  toAddress: string,
  amount: string,
  data?: string | Uint8Array | Cell,
  stateInit?: Cell,
  shouldEncrypt?: boolean,
) {
  const { network } = parseAccountId(accountId);

  const result: {
    error?: ApiTransactionDraftError;
    fee?: string;
    addressName?: string;
    isScam?: boolean;
  } = {};

  const resolvedAddress = await resolveAddress(network, toAddress);
  if (!resolvedAddress) {
    result.error = ApiTransactionDraftError.DomainNotResolved;
    return result;
  }

  toAddress = resolvedAddress;
  if (!Address.isValid(toAddress)) {
    result.error = ApiTransactionDraftError.InvalidToAddress;
    return result;
  }

  const addressInfo = await getAddressInfo(toAddress);
  result.addressName = addressInfo?.name;
  result.isScam = addressInfo?.isScam;

  if (BigInt(amount) < BigInt(0)) {
    result.error = ApiTransactionDraftError.InvalidAmount;
    return result;
  }

  const wallet = await pickAccountWallet(storage, accountId);
  if (!wallet) {
    result.error = ApiTransactionDraftError.Unexpected;
    return result;
  }

  if (data && typeof data === 'string' && shouldEncrypt) {
    const toPublicKey = await getWalletPublicKey(network, toAddress);
    if (!toPublicKey) {
      result.error = ApiTransactionDraftError.WalletNotInitialized;
      return result;
    }
  }

  if (tokenSlug !== TON_TOKEN_SLUG) {
    if (data && typeof data !== 'string') {
      result.error = ApiTransactionDraftError.Unexpected;
      return result;
    }

    const address = await fetchStoredAddress(storage, accountId);
    const tokenAmount: string = amount;
    let tokenWallet: JettonWalletType;
    ({
      tokenWallet,
      amount,
      toAddress,
      payload: data,
    } = await buildTokenTransfer(network, tokenSlug, address, toAddress, amount, data));

    const tokenBalance = await getTokenWalletBalance(tokenWallet!);
    if (BigInt(tokenBalance) < BigInt(tokenAmount!)) {
      result.error = ApiTransactionDraftError.InsufficientBalance;
      return result;
    }
  }

  const isInitialized = await isWalletInitialized(network, wallet);
  result.fee = await calculateFee(isInitialized, async () => (await signTransaction(
    network, wallet, toAddress, amount, data, stateInit,
  )).query);

  const balance = await getWalletBalance(network, wallet);
  if (BigInt(balance) < BigInt(amount) + BigInt(result.fee)) {
    result.error = ApiTransactionDraftError.InsufficientBalance;
    return result;
  }

  return result;
}

export async function submitTransfer(
  storage: Storage,
  accountId: string,
  password: string,
  tokenSlug: string,
  toAddress: string,
  amount: string,
  data?: string | Uint8Array | Cell,
  stateInit?: Cell,
  shouldEncrypt?: boolean,
): Promise<SubmitTransferResult> {
  const { network } = parseAccountId(accountId);

  try {
    const [wallet, fromAddress, keyPair] = await Promise.all([
      pickAccountWallet(storage, accountId),
      fetchStoredAddress(storage, accountId),
      fetchKeyPair(storage, accountId, password),
    ]);
    const { publicKey, secretKey } = keyPair!;

    let encryptedComment: string | undefined;
    let resolvedAddress = await resolveAddress(network, toAddress);

    if (data && typeof data === 'string' && shouldEncrypt) {
      const toPublicKey = (await getWalletPublicKey(network, toAddress))!;
      data = await encryptMessageComment(data, publicKey, toPublicKey, secretKey, fromAddress);
      encryptedComment = Buffer.from(data.slice(4)).toString('base64');
    }

    if (tokenSlug !== TON_TOKEN_SLUG) {
      if (data && typeof data !== 'string') {
        throw new Error('Unknown error');
      }

      ({
        amount,
        toAddress: resolvedAddress,
        payload: data,
      } = await buildTokenTransfer(network, tokenSlug, fromAddress, resolvedAddress, amount, data));
    }

    // Force default bounceable address for `waitTxComplete` to work properly
    resolvedAddress = toBase64Address(resolvedAddress);

    await waitLastTransfer(network, fromAddress);

    const [{ isInitialized, balance }, toWalletInfo] = await Promise.all([
      getWalletInfo(network, wallet!),
      getWalletInfo(network, resolvedAddress),
    ]);

    // Force non-bounceable for non-initialized recipients
    toAddress = toWalletInfo.isInitialized
      ? resolvedAddress
      : toBase64Address(resolvedAddress, false);

    const { seqno, query } = await signTransaction(network, wallet!, toAddress, amount, data, stateInit, secretKey);

    const fee = await calculateFee(isInitialized, query);
    if (BigInt(balance) < BigInt(amount) + BigInt(fee)) {
      return { error: ApiTransactionError.InsufficientBalance };
    }

    await query.send();

    updateLastTransfer(network, fromAddress, seqno);

    return {
      resolvedAddress, amount, seqno, encryptedComment,
    };
  } catch (err: any) {
    logDebugError('submitTransfer', err);

    return { error: resolveTransactionError(err) };
  }
}

function resolveTransactionError(error: any): ApiTransactionError {
  const message = typeof error === 'string' ? error : error?.message;
  if (message?.includes('exitcode=35,')) {
    return ApiTransactionError.IncorrectDeviceTime;
  }
  return ApiTransactionError.UnsuccesfulTransfer;
}

async function signTransaction(
  network: ApiNetwork,
  wallet: WalletContract,
  toAddress: string,
  amount: string,
  payload?: string | Uint8Array | Cell,
  stateInit?: Cell,
  privateKey?: Uint8Array,
) {
  const { seqno } = await getWalletInfo(network, wallet);

  const query = wallet.methods.transfer({
    secretKey: privateKey as any, // Workaround for wrong typing
    toAddress,
    amount,
    payload,
    seqno: seqno || 0,
    sendMode: 3,
    stateInit,
  });

  return { seqno, query };
}

export async function getAccountNewestTxId(storage: Storage, accountId: string) {
  const { network } = parseAccountId(accountId);
  const address = await fetchStoredAddress(storage, accountId);

  return fetchNewestTxId(network, address);
}

export async function getAccountTransactionSlice(
  storage: Storage,
  accountId: string,
  beforeTxId?: string,
  afterTxId?: string,
  limit?: number,
) {
  const { network } = parseAccountId(accountId);
  const address = await fetchStoredAddress(storage, accountId);

  const transactions = await getTransactionSlice(network, address, {
    beforeTxId,
    afterTxId,
    limit,
  });

  return transactions
    .map(parseTransactionBody)
    .map(updateTransactionMetadata)
    .map(omitExtraData);
}

export async function getMergedTransactionSlice(
  storage: Storage,
  accountId: string,
  lastTxIds: ApiTxIdBySlug,
  limit: number,
) {
  // eslint-disable-next-line prefer-const
  let { toncoin: lastTonTxId, ...tokenLastTxIds } = lastTxIds;
  const tonTxs = await getAccountTransactionSlice(storage, accountId, lastTonTxId, undefined, limit);

  if (!tonTxs.length) {
    return [];
  }

  lastTonTxId = tonTxs[tonTxs.length - 1].txId;
  const lastTonTxLt = parseTxId(lastTonTxId).lt;

  const results = await Promise.all(Object.entries(tokenLastTxIds).map(([slug, lastTxId]) => {
    if (lastTxId && parseTxId(lastTxId).lt < lastTonTxLt) {
      return [];
    }
    return getTokenTransactionSlice(
      storage, accountId, slug, lastTxId, lastTonTxId, GET_TRANSACTIONS_MAX_LIMIT,
    );
  }));

  const allTxs = [...tonTxs, ...results.flat()];
  allTxs.sort((a, b) => compareTransactions(a, b, false));

  return allTxs;
}

export async function getTokenTransactionSlice(
  storage: Storage,
  accountId: string,
  tokenSlug: string,
  beforeTxId?: string,
  afterTxId?: string,
  limit?: number,
) {
  if (tokenSlug === TON_TOKEN_SLUG) {
    return getAccountTransactionSlice(storage, accountId, beforeTxId, afterTxId, limit);
  }

  const { network } = parseAccountId(accountId);
  const address = await fetchStoredAddress(storage, accountId);

  const minterAddress = resolveTokenBySlug(tokenSlug).minterAddress!;
  const tokenWalletAddress = await resolveTokenWalletAddress(network, address, minterAddress);

  const transactions = await getTransactionSlice(network, tokenWalletAddress, {
    beforeTxId,
    afterTxId,
    limit,
  });

  const parsedTxs = transactions
    .map((tx) => parseTokenTransaction(tx, tokenSlug, address))
    .filter(Boolean)
    .map(updateTransactionMetadata)
    .map(omitExtraData);

  return parsedTxs.filter(Boolean);
}

export async function getTransactionSlice(network: ApiNetwork, address: string, options: {
  beforeTxId?: string;
  afterTxId?: string;
  limit?: number;
}): Promise<ApiTransactionExtra[]> {
  const {
    beforeTxId,
    afterTxId,
    limit = GET_TRANSACTIONS_LIMIT,
  } = options || {};
  const beforeLt = beforeTxId ? Number(parseTxId(beforeTxId).lt) : undefined;
  const afterLt = afterTxId ? Number(parseTxId(afterTxId).lt) : undefined;

  const rawTxs = await fetchAccountTransactions(
    network,
    address,
    limit,
    afterLt,
    beforeLt,
  );

  return rawTxs.map(parseNestedApiTransactions).flat();
}

function omitExtraData(tx: ApiTransactionExtra): ApiTransaction {
  return omit(tx, ['extraData']);
}

function parseTxId(txId: string) {
  const [lt, hash] = txId.split(':');
  return { lt: Number(lt), hash };
}

function parseNestedApiTransactions(rawTx: RawTransaction): ApiTransactionExtra[] {
  const isIncoming = Boolean(rawTx.inMsg?.source);
  const msgs = isIncoming ? [rawTx.inMsg!] : rawTx.outMsgs;
  if (!msgs[0]) {
    return [];
  }

  const txId = stringifyTxId({
    lt: rawTx.lt.toString(),
    hash: hexToBase64(rawTx.hash),
  });
  const slug = TON_TOKEN_SLUG;
  const timestamp = Number(rawTx.utime * 1000);
  const fee = rawTx.fee.toString();

  const transactions = msgs.map((msg, i) => {
    const metadata = isIncoming ? {
      isScam: msg.source?.isScam,
      name: msg.source?.name,
    } : {
      isScam: msg.destination?.isScam,
      name: msg.destination?.name,
    };
    return {
      txId: msgs.length > 1 ? `${txId}:${i}` : txId,
      timestamp,
      isIncoming,
      fromAddress: toBase64Address(msg.source!.address!),
      toAddress: toBase64Address(msg.destination!.address!),
      amount: isIncoming ? msg.value.toString() : `-${msg.value}`,
      comment: parseComment(msg.msgData),
      fee: i === 0 ? fee : '0',
      slug,
      metadata,
      extraData: { body: msg.msgData },
    } as ApiTransactionExtra;
  });

  return transactions.map(updateTransactionType);
}

function updateTransactionType(transaction: ApiTransactionExtra) {
  const {
    fromAddress, toAddress, comment, amount,
  } = transaction;

  if (fromAddress && toAddress) {
    const amountNumber = Math.abs(Number(fromNano(amount)));

    if (isKnownStakingPool(fromAddress) && amountNumber > 1) {
      transaction.type = 'unstake';
    } else if (isKnownStakingPool(toAddress)) {
      if (comment === STAKE_COMMENT) {
        transaction.type = 'stake';
      } else if (comment === UNSTAKE_COMMENT) {
        transaction.type = 'unstakeRequest';
      }
    }
  }

  return transaction;
}

function parseComment(msgData?: string) {
  if (msgData) {
    try {
      const bytes = base64ToBytes(msgData);
      const firstBytes = Array.from(bytes.slice(0, 4));
      if (firstBytes.toString() === DATA_TEXT_PREFIX) {
        return new TextDecoder('utf-8', {
          fatal: true,
          ignoreBOM: true,
        }).decode(bytes.slice(4));
      }
    } catch (err) {
      // do nothing
    }
  }
  return undefined;
}

export async function checkMultiTransactionDraft(
  storage: Storage,
  accountId: string,
  messages: TonTransferParams[],
) {
  const { network } = parseAccountId(accountId);

  const result: {
    error?: ApiTransactionDraftError;
    fee?: string;
    totalAmount?: string;
  } = {};

  let totalAmount: bigint = 0n;

  for (const { toAddress, amount } of messages) {
    if (BigInt(amount) < BigInt(0)) {
      result.error = ApiTransactionDraftError.InvalidAmount;
      return result;
    }
    if (!Address.isValid(toAddress)) {
      result.error = ApiTransactionDraftError.InvalidToAddress;
      return result;
    }
    totalAmount += BigInt(amount);
  }

  const wallet = await pickAccountWallet(storage, accountId);

  if (!wallet) {
    result.error = ApiTransactionDraftError.Unexpected;
    return result;
  }

  const { isInitialized, balance } = await getWalletInfo(network, wallet);

  result.fee = await calculateFee(isInitialized, async () => (await signMultiTransaction(
    network, wallet, messages,
  )).query);
  result.totalAmount = totalAmount.toString();

  if (BigInt(balance) < totalAmount + BigInt(result.fee)) {
    result.error = ApiTransactionDraftError.InsufficientBalance;
    return result;
  }

  return result;
}

export async function submitMultiTransfer(
  storage: Storage,
  accountId: string,
  password: string,
  messages: TonTransferParams[],
  expireAt?: number,
): Promise<SubmitMultiTransferResult> {
  const { network } = parseAccountId(accountId);

  try {
    const [wallet, fromAddress, privateKey] = await Promise.all([
      pickAccountWallet(storage, accountId),
      fetchStoredAddress(storage, accountId),
      fetchPrivateKey(storage, accountId, password),
    ]);

    let totalAmount = 0n;
    const preparedMessages = await Promise.all(messages.map(async (message) => {
      let { toAddress } = message;

      // Force default bounceable address for `waitTxComplete` to work properly
      const resolvedAddress = toBase64Address(toAddress);
      toAddress = await isWalletInitialized(network, toAddress)
        ? resolvedAddress
        : toBase64Address(toAddress, false);

      totalAmount += BigInt(message.amount);

      return {
        ...message,
        toAddress,
        resolvedAddress,
      };
    }));

    await waitLastTransfer(network, fromAddress);

    const { isInitialized, balance } = await getWalletInfo(network, wallet!);

    const { seqno, query } = await signMultiTransaction(network, wallet!, preparedMessages, privateKey, expireAt);

    const fee = await calculateFee(isInitialized, query);
    if (BigInt(balance) < BigInt(totalAmount) + BigInt(fee)) {
      return { error: ApiTransactionError.InsufficientBalance };
    }

    await query.send();

    updateLastTransfer(network, fromAddress, seqno);

    return {
      seqno,
      amount: totalAmount.toString(),
      messages: preparedMessages,
    };
  } catch (err) {
    logDebugError('submitMultiTransfer', err);
    return { error: resolveTransactionError(err) };
  }
}

async function signMultiTransaction(
  network: ApiNetwork,
  wallet: WalletContract,
  messages: TonTransferParams[],
  privateKey?: Uint8Array,
  expireAt?: number,
) {
  const { seqno } = await getWalletInfo(network, wallet);
  if (!expireAt) {
    expireAt = Math.round(Date.now() / 1000) + DEFAULT_EXPIRE_AT_TIMEOUT_SEC;
  }

  // TODO Uncomment after fixing types in tonweb
  // @ts-ignore
  const query = wallet.methods.transfers({
    secretKey: privateKey as any,
    seqno: seqno || 0,
    messages,
    sendMode: 3,
    expireAt,
  });

  return { query, seqno };
}

function updateLastTransfer(network: ApiNetwork, address: string, seqno: number) {
  lastTransfers[network][address] = {
    timestamp: Date.now(),
    seqno,
  };
}

export async function waitLastTransfer(network: ApiNetwork, address: string) {
  const lastTransfer = lastTransfers[network][address];
  if (!lastTransfer) return;

  const { seqno, timestamp } = lastTransfer;
  const waitUntil = timestamp + WAIT_SEQNO_TIMEOUT;

  const result = await waitIncrementSeqno(network, address, seqno, waitUntil);
  if (result) {
    delete lastTransfers[network][address];
  }
}

async function waitIncrementSeqno(network: ApiNetwork, address: string, seqno: number, waitUntil?: number) {
  if (!waitUntil) {
    waitUntil = Date.now() + WAIT_SEQNO_TIMEOUT;
  }

  while (Date.now() < waitUntil) {
    try {
      const { seqno: currentSeqno } = await getWalletInfo(network, address);
      if (currentSeqno > seqno) {
        return true;
      }

      await pause(WAIT_SEQNO_PAUSE);
    } catch (err) {
      logDebugError('waitIncrementSeqno', err);
    }
  }

  return false;
}

async function calculateFee(isInitialized: boolean, query: Method | (() => Promise<Method>)) {
  if (typeof query === 'function') {
    query = await query();
  }
  if (isInitialized) {
    const allFees = await query.estimateFee();
    const fees = allFees.source_fees;
    return String(fees.in_fwd_fee + fees.storage_fee + fees.gas_fee + fees.fwd_fee);
  } else {
    return DEFAULT_FEE;
  }
}

export async function parsePayload(network: ApiNetwork, toAddress: string, base64: string): Promise<ApiParsedPayload> {
  try {
    let slice = TonCell.fromBase64(base64).beginParse();
    const opCode = slice.loadUint(32);

    if (opCode === 0) {
      const comment = slice.loadStringTail();
      return {
        type: 'comment',
        comment,
      };
    }

    const queryId = slice.loadUint(64).toString();

    switch (opCode) {
      case JettonOpCode.transfer: {
        const minterAddress = await resolveTokenMinterAddress(network, toAddress);
        const slug = buildTokenSlug(minterAddress);

        const amount = slice.loadCoins();
        const destination = slice.loadAddress();
        const responseDestination = slice.loadMaybeAddress();

        if (!responseDestination) {
          return {
            type: 'transfer-tokens:non-standard',
            queryId,
            destination: toBounceableAddress(destination),
            amount: amount.toString(),
            slug,
          };
        }

        const customPayload = slice.loadMaybeRef();
        const forwardAmount = slice.loadCoins();
        let forwardPayload = slice.loadMaybeRef();
        if (!forwardPayload && slice.remainingBits) {
          forwardPayload = new Builder()
            .storeBits(slice.loadBits(slice.remainingBits))
            .endCell();
          slice = forwardPayload.beginParse();
        }

        return {
          type: 'transfer-tokens',
          queryId,
          amount: amount.toString(),
          destination: toBounceableAddress(destination),
          responseDestination: toBounceableAddress(responseDestination),
          customPayload: customPayload?.toBoc().toString('base64'),
          forwardAmount: forwardAmount.toString(),
          forwardPayload: forwardPayload?.toBoc().toString('base64'),
          slug,
        };
      }
      case NftOpCode.transferOwnership: {
        const newOwner = slice.loadAddress();
        const responseDestination = slice.loadAddress();
        const customPayload = slice.loadMaybeRef();
        const forwardAmount = slice.loadCoins();

        let forwardPayload = slice.loadMaybeRef();
        if (!forwardPayload && slice.remainingBits) {
          forwardPayload = new Builder()
            .storeBits(slice.loadBits(slice.remainingBits))
            .endCell();
          slice = forwardPayload.beginParse();
        }

        const nftAddress = toAddress;
        const [nft] = await fetchNftItems(network, [nftAddress]);
        return {
          type: 'transfer-nft',
          queryId,
          newOwner: toBounceableAddress(newOwner),
          responseDestination: toBounceableAddress(responseDestination),
          customPayload: customPayload?.toBoc().toString('base64'),
          forwardAmount: forwardAmount.toString(),
          forwardPayload: forwardPayload?.toBoc().toString('base64'),
          nftAddress,
          nftName: nft?.metadata?.name,
        };
      }
    }
  } catch (err) {
    logDebugError('parseJettonWalletMsgBody', err);
  }

  return {
    type: 'unknown',
    base64,
  };
}

export async function sendSignedMessage(storage: Storage, accountId: string, message: ApiSignedTransfer) {
  const { network } = parseAccountId(accountId);
  const [fromAddress, publicKey, account] = await Promise.all([
    fetchStoredAddress(storage, accountId),
    fetchStoredPublicKey(storage, accountId),
    fetchStoredAccount(storage, accountId),
  ]);
  const wallet = getTonWalletContract(publicKey!, account!.version!);
  const client = getTonClient(network);
  const contract = client.open(wallet);

  const { base64, seqno } = message;
  await contract.send(TonCell.fromBase64(base64));

  updateLastTransfer(network, fromAddress, seqno);
}

export async function sendSignedMessages(storage: Storage, accountId: string, messages: ApiSignedTransfer[]) {
  const { network } = parseAccountId(accountId);
  const [fromAddress, publicKey, account] = await Promise.all([
    fetchStoredAddress(storage, accountId),
    fetchStoredPublicKey(storage, accountId),
    fetchStoredAccount(storage, accountId),
  ]);
  const wallet = getTonWalletContract(publicKey!, account!.version!);
  const client = getTonClient(network);
  const contract = client.open(wallet);

  const attempts = ATTEMPTS + messages.length;
  let index = 0;
  let attempt = 0;

  while (index < messages.length && attempt < attempts) {
    const { base64, seqno } = messages[index];
    try {
      await waitLastTransfer(network, fromAddress);

      await contract.send(TonCell.fromBase64(base64));

      updateLastTransfer(network, fromAddress, seqno);

      index++;
    } catch (err) {
      logDebugError('sendSignedMessages', err);
    }
    attempt++;
  }

  return { successNumber: index };
}

export async function decryptComment(
  storage: Storage, accountId: string, encryptedComment: string, fromAddress: string, password: string,
) {
  const keyPair = (await fetchKeyPair(storage, accountId, password))!;
  const { secretKey, publicKey } = keyPair;

  const buffer = Buffer.from(encryptedComment, 'base64');

  return decryptMessageComment(buffer, publicKey, secretKey, fromAddress);
}

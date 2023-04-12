import { Cell } from 'tonweb/dist/types/boc/cell';
import { WalletContract } from 'tonweb/dist/types/contract/wallet/wallet-contract';
import TonWeb from 'tonweb';
import { Transaction as RawTransaction } from 'tonapi-sdk-js/dist/models/Transaction';
import { Cell as TonCell } from 'ton-core';

import { Storage } from '../../storages/types';
import {
  ApiNetwork,
  ApiParsedPayload,
  ApiTransaction,
  ApiTransactionDraftError,
  ApiTxIdBySlug,
} from '../../types';
import { DEBUG, TON_TOKEN_SLUG } from '../../../config';
import { base64ToBytes, hexToBase64, isKnownStakingPool } from '../../common/utils';
import {
  getWalletBalance,
  getWalletInfo,
  isWalletInitialized,
  pickAccountWallet,
} from './wallet';
import { fetchPrivateKey } from './auth';
import { fetchNewestTxId, toBase64Address } from './util/tonweb';
import { fetchAddress, resolveAddress } from './address';
import {
  buildTokenSlug,
  buildTokenTransfer,
  getTokenWalletBalance,
  JettonWalletType,
  parseTokenTransaction,
  resolveTokenBySlug,
  resolveTokenMinterAddress,
  resolveTokenWalletAddress,
} from './tokens';
import { fetchAccountTransactions, fetchNftItems } from './util/tonapiio';
import { ApiTransactionExtra, TonTransferParams } from './types';
import { parseAccountId } from '../../../util/account';
import {
  JettonOpCode, NftOpCode, STAKE_COMMENT, UNSTAKE_COMMENT,
} from './constants';
import { pause } from '../../../util/schedulers';
import { stringifyTxId } from './util';
import { omit } from '../../../util/iteratees';
import { getAddressInfo } from '../../common/addresses';
import { compareTransactions, updateTransactionMetadata } from '../../common/helpers';
import { toBounceableAddress } from './util/metadata';

const { Address, fromNano } = TonWeb.utils;

const DEFAULT_FEE = '10966001';
const DEFAULT_EXPIRE_AT_TIMEOUT_SEC = 60; // 60 sec.
const GET_TRANSACTIONS_LIMIT = 50;
const GET_TRANSACTIONS_MAX_LIMIT = 1000;
const DATA_TEXT_PREFIX = [0, 0, 0, 0].toString();
const WAIT_SEQNO_TIMEOUT = 10000; // 10 sec.
const WAIT_SEQNO_PAUSE = 300; // 0.3 sec.

export async function checkTransactionDraft(
  storage: Storage,
  accountId: string,
  tokenSlug: string,
  toAddress: string,
  amount: string,
  data?: string | Uint8Array | Cell,
  stateInit?: Cell,
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

  if (tokenSlug !== TON_TOKEN_SLUG) {
    if (data && typeof data !== 'string') {
      result.error = ApiTransactionDraftError.Unexpected;
      return result;
    }

    const address = await fetchAddress(storage, accountId);
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

  if (await isWalletInitialized(network, wallet)) {
    const query = await signTransaction(network, wallet, toAddress, amount, data, stateInit);
    const allFees = await query.estimateFee();
    const fees = allFees.source_fees;
    result.fee = String(fees.in_fwd_fee + fees.storage_fee + fees.gas_fee + fees.fwd_fee);
  } else {
    result.fee = DEFAULT_FEE;
  }

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
) {
  const { network } = parseAccountId(accountId);

  const wallet = await pickAccountWallet(storage, accountId);
  if (!wallet) {
    return undefined;
  }

  const privateKey = await fetchPrivateKey(storage, accountId, password);
  if (!privateKey) {
    return undefined;
  }

  let resolvedAddress = await resolveAddress(network, toAddress);
  if (!resolvedAddress) {
    return undefined;
  }

  if (tokenSlug !== TON_TOKEN_SLUG) {
    if (data && typeof data !== 'string') {
      return undefined;
    }

    const address = await fetchAddress(storage, accountId);
    ({
      amount,
      toAddress: resolvedAddress,
      payload: data,
    } = await buildTokenTransfer(network, tokenSlug, address, resolvedAddress, amount, data));
  }

  // Force default bounceable address for `waitTxComplete` to work properly
  resolvedAddress = (new Address(resolvedAddress)).toString(true, true, true);

  // Force non-bounceable for non-initialized recipients
  toAddress = !(await isWalletInitialized(network, resolvedAddress))
    ? (new Address(resolvedAddress)).toString(true, true, false)
    : resolvedAddress;

  const { seqno } = await getWalletInfo(network, wallet);
  const query = await signTransaction(network, wallet, toAddress, amount, data, stateInit, privateKey);
  await query.send();

  return { resolvedAddress, amount, seqno };
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

  return wallet.methods.transfer({
    secretKey: privateKey as any, // Workaround for wrong typing
    toAddress,
    amount,
    payload,
    seqno: seqno || 0,
    sendMode: 3,
    stateInit,
  });
}

export async function getAccountNewestTxId(storage: Storage, accountId: string) {
  const { network } = parseAccountId(accountId);
  const address = await fetchAddress(storage, accountId);

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
  const address = await fetchAddress(storage, accountId);

  const transactions = await getTransactionSlice(network, address, {
    beforeTxId,
    afterTxId,
    limit,
  });

  return transactions
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
  const address = await fetchAddress(storage, accountId);

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

export async function waitIncrementSeqno(network: ApiNetwork, address: string, seqno: number) {
  const waitUntil = new Date().getTime() + WAIT_SEQNO_TIMEOUT;
  while (new Date().getTime() < waitUntil) {
    try {
      const { seqno: currentSeqno } = await getWalletInfo(network, address);
      if (currentSeqno > seqno) return true;

      await pause(WAIT_SEQNO_PAUSE);
    } catch (err) {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.error('[waitIncrementSeqno]', err);
      }
    }
  }
  return false;
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

  if (await isWalletInitialized(network, wallet)) {
    const { query } = await signMultiTransaction(network, wallet, messages);
    const allFees = await query.estimateFee();
    const fees = allFees.source_fees;
    result.fee = String(fees.in_fwd_fee + fees.storage_fee + fees.gas_fee + fees.fwd_fee);
  } else {
    result.fee = DEFAULT_FEE;
  }
  result.totalAmount = totalAmount.toString();

  const balance = await getWalletBalance(network, wallet);
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
) {
  const { network } = parseAccountId(accountId);

  const wallet = await pickAccountWallet(storage, accountId);
  if (!wallet) {
    return undefined;
  }

  const privateKey = await fetchPrivateKey(storage, accountId, password);
  if (!privateKey) {
    return undefined;
  }

  const preparedMessages = await Promise.all(messages.map(async (message) => {
    let { toAddress } = message;

    // Force default bounceable address for `waitTxComplete` to work properly
    const resolvedAddress = (new Address(toAddress)).toString(true, true, true);
    toAddress = !(await isWalletInitialized(network, toAddress))
      ? (new Address(toAddress)).toString(true, true, false)
      : resolvedAddress;

    return {
      ...message,
      toAddress,
      resolvedAddress,
    };
  }));

  const { seqno, query } = await signMultiTransaction(network, wallet, preparedMessages, privateKey, expireAt);
  const result = await query.send();

  return {
    seqno,
    messages: preparedMessages,
    result,
  };
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

    slice.loadUint(64); // queryId

    switch (opCode) {
      case JettonOpCode.transfer: {
        const minterAddress = await resolveTokenMinterAddress(network, toAddress);

        const amount = slice.loadCoins();
        const address = slice.loadAddress();
        let comment: string | undefined;

        if (slice.loadMaybeAddress()) {
          slice.loadBit();
          slice.loadCoins();
          const isSeparateCell = slice.remainingBits && slice.loadBit();
          if (isSeparateCell && slice.remainingRefs) {
            slice = slice.loadRef().beginParse();
          }
          if (slice.remainingBits > 32 && slice.loadUint(32) === 0) {
            comment = slice.loadStringTail();
          }
        }

        return {
          type: 'transfer-tokens',
          slug: buildTokenSlug(minterAddress),
          toAddress: toBounceableAddress(address),
          amount: amount.toString(),
          comment,
        };
      }
      case NftOpCode.transferOwnership: {
        const address = toBounceableAddress(slice.loadAddress());
        const nftAddress = toAddress;
        const [nft] = await fetchNftItems(network, [nftAddress]);
        return {
          type: 'transfer-nft',
          nftAddress,
          nftName: nft?.metadata?.name,
          toAddress: address,
        };
      }
    }
  } catch (err) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error('[parseJettonWalletMsgBody]', err);
    }
  }

  return {
    type: 'unknown',
    base64,
  };
}

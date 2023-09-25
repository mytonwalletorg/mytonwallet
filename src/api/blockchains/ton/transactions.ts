import { Cell as TonCell } from 'ton-core';
import type { Method } from 'tonweb';
import TonWeb from 'tonweb';
import type { Cell } from 'tonweb/dist/types/boc/cell';
import type { WalletContract } from 'tonweb/dist/types/contract/wallet/wallet-contract';

import { ApiTransactionDraftError, ApiTransactionError } from '../../types';
import type {
  ApiNetwork, ApiSignedTransfer, ApiTransaction, ApiTxIdBySlug,
} from '../../types';
import type { AnyPayload, ApiTransactionExtra, TonTransferParams } from './types';

import { TON_TOKEN_SLUG } from '../../../config';
import { parseAccountId } from '../../../util/account';
import { compareTransactions } from '../../../util/compareTransactions';
import { omit } from '../../../util/iteratees';
import { isValidLedgerComment } from '../../../util/ledger/utils';
import { logDebugError } from '../../../util/logs';
import { pause } from '../../../util/schedulers';
import withCacheAsync from '../../../util/withCacheAsync';
import { parseTxId } from './util';
import { decryptMessageComment, encryptMessageComment } from './util/encryption';
import { parseWalletTransactionBody } from './util/metadata';
import { getTonClient, getTonWalletContract } from './util/tonCore';
import {
  commentToBytes,
  fetchNewestTxId,
  fetchTransactions,
  getWalletPublicKey,
  packBytesAsSnake,
  parseBase64,
  resolveTokenWalletAddress,
  toBase64Address,
} from './util/tonweb';
import { fetchStoredAccount, fetchStoredAddress, fetchStoredPublicKey } from '../../common/accounts';
import { getAddressInfo } from '../../common/addresses';
import { updateTransactionMetadata } from '../../common/helpers';
import { bytesToBase64, isKnownStakingPool } from '../../common/utils';
import { resolveAddress } from './address';
import { fetchKeyPair, fetchPrivateKey } from './auth';
import { ATTEMPTS, STAKE_COMMENT, UNSTAKE_COMMENT } from './constants';
import type { JettonWalletType } from './tokens';
import {
  buildTokenTransfer, getTokenWalletBalance, parseTokenTransaction, resolveTokenBySlug,
} from './tokens';
import {
  getWalletBalance, getWalletInfo, isWalletInitialized, pickAccountWallet,
} from './wallet';

type SubmitTransferResult = {
  normalizedAddress: string;
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
  boc: string;
} | {
  error: string;
};

const { Address, fromNano } = TonWeb.utils;

const DEFAULT_FEE = '10966001';
const DEFAULT_EXPIRE_AT_TIMEOUT_SEC = 60; // 60 sec.
const GET_TRANSACTIONS_LIMIT = 50;
const GET_TRANSACTIONS_MAX_LIMIT = 100;
const WAIT_SEQNO_TIMEOUT = 40000; // 40 sec.
const WAIT_SEQNO_PAUSE = 5000; // 5 sec.

const lastTransfers: Record<ApiNetwork, Record<string, {
  timestamp: number;
  seqno: number;
}>> = {
  mainnet: {},
  testnet: {},
};

export const checkHasTransaction = withCacheAsync(async (network: ApiNetwork, address: string) => {
  const transactions = await fetchTransactions(network, address, 1);
  return Boolean(transactions.length);
});

export async function checkTransactionDraft(
  accountId: string,
  tokenSlug: string,
  toAddress: string,
  amount: string,
  data?: AnyPayload,
  stateInit?: Cell,
  shouldEncrypt?: boolean,
  isBase64Data?: boolean,
) {
  const { network } = parseAccountId(accountId);

  const result: {
    fee?: string;
    addressName?: string;
    isScam?: boolean;
    resolvedAddress?: string;
    normalizedAddress?: string;
    isToAddressNew?: boolean;
  } = {};

  const resolved = await resolveAddress(network, toAddress);
  if (resolved) {
    result.addressName = resolved.domain;
    toAddress = resolved.address;
  } else {
    return { ...result, error: ApiTransactionDraftError.DomainNotResolved };
  }

  if (!Address.isValid(toAddress)) {
    return { ...result, error: ApiTransactionDraftError.InvalidToAddress };
  }

  const {
    isUserFriendly, isTestOnly, isBounceable,
  } = new Address(toAddress);

  const regex = /[+=/]/; // Temp check for `isUrlSafe`. Remove after TonWeb fixes the issue
  const isUrlSafe = !regex.test(toAddress);

  if (!isUserFriendly || !isUrlSafe || (network === 'mainnet' && isTestOnly)) {
    return { ...result, error: ApiTransactionDraftError.InvalidAddressFormat };
  }

  if (isBounceable) {
    const isInitialized = await isWalletInitialized(network, toAddress);
    if (!isInitialized) {
      result.isToAddressNew = !(await checkHasTransaction(network, toAddress));
      if (tokenSlug === TON_TOKEN_SLUG) {
        toAddress = toBase64Address(toAddress, false);
      }
    }
  }

  result.resolvedAddress = toAddress;
  result.normalizedAddress = toBase64Address(toAddress);

  const addressInfo = await getAddressInfo(toAddress);
  if (addressInfo?.name) result.addressName = addressInfo.name;
  if (addressInfo?.isScam) result.isScam = addressInfo.isScam;

  if (BigInt(amount) < BigInt(0)) {
    return { ...result, error: ApiTransactionDraftError.InvalidAmount };
  }

  const wallet = await pickAccountWallet(accountId);
  if (!wallet) {
    return { ...result, error: ApiTransactionDraftError.Unexpected };
  }

  if (typeof data === 'string' && isBase64Data) {
    data = parseBase64(data);
  }

  if (data && typeof data === 'string' && shouldEncrypt) {
    const toPublicKey = await getWalletPublicKey(network, toAddress);
    if (!toPublicKey) {
      return { ...result, error: ApiTransactionDraftError.WalletNotInitialized };
    }
  }

  const account = await fetchStoredAccount(accountId);
  const isLedger = !!account?.ledger;

  if (data && typeof data === 'string' && !isBase64Data && !isLedger) {
    data = commentToBytes(data);
  }

  if (tokenSlug === TON_TOKEN_SLUG) {
    if (data && isLedger && (typeof data !== 'string' || shouldEncrypt || !isValidLedgerComment(data))) {
      return { ...result, error: ApiTransactionDraftError.UnsupportedHardwarePayload };
    }

    if (data instanceof Uint8Array) {
      data = packBytesAsSnake(data);
    }
  } else {
    const address = await fetchStoredAddress(accountId);
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
      return { ...result, error: ApiTransactionDraftError.InsufficientBalance };
    }
  }

  const isOurWalletInitialized = await isWalletInitialized(network, wallet);
  result.fee = await calculateFee(isOurWalletInitialized, async () => (await signTransaction(
    network, wallet, toAddress, amount, data, stateInit,
  )).query);

  const balance = await getWalletBalance(network, wallet);
  if (BigInt(balance) < BigInt(amount) + BigInt(result.fee)) {
    return { ...result, error: ApiTransactionDraftError.InsufficientBalance };
  }

  return result as {
    fee: string;
    resolvedAddress: string;
    normalizedAddress: string;
    addressName?: string;
    isScam?: boolean;
    isToAddressNew?: boolean;
  };
}

export async function submitTransfer(
  accountId: string,
  password: string,
  tokenSlug: string,
  toAddress: string,
  amount: string,
  data?: AnyPayload,
  stateInit?: Cell,
  shouldEncrypt?: boolean,
  isBase64Data?: boolean,
): Promise<SubmitTransferResult> {
  const { network } = parseAccountId(accountId);

  try {
    const [wallet, fromAddress, keyPair] = await Promise.all([
      pickAccountWallet(accountId),
      fetchStoredAddress(accountId),
      fetchKeyPair(accountId, password),
    ]);
    const { publicKey, secretKey } = keyPair!;

    let encryptedComment: string | undefined;
    // Force default bounceable address for `waitTxComplete` to work properly
    const normalizedAddress = toBase64Address(toAddress);

    if (data && typeof data === 'string') {
      if (isBase64Data) {
        data = parseBase64(data);
      } else if (shouldEncrypt) {
        const toPublicKey = (await getWalletPublicKey(network, toAddress))!;
        data = await encryptMessageComment(data, publicKey, toPublicKey, secretKey, fromAddress);
        encryptedComment = Buffer.from(data.slice(4)).toString('base64');
      } else {
        data = commentToBytes(data);
      }
    }

    if (tokenSlug === TON_TOKEN_SLUG) {
      if (data instanceof Uint8Array) {
        data = packBytesAsSnake(data);
      }
    } else {
      ({
        amount,
        toAddress,
        payload: data,
      } = await buildTokenTransfer(network, tokenSlug, fromAddress, toAddress, amount, data));
    }

    await waitLastTransfer(network, fromAddress);

    const { isInitialized, balance } = await getWalletInfo(network, wallet!);

    const { seqno, query } = await signTransaction(network, wallet!, toAddress, amount, data, stateInit, secretKey);

    const fee = await calculateFee(isInitialized, query);
    if (BigInt(balance) < BigInt(amount) + BigInt(fee)) {
      return { error: ApiTransactionError.InsufficientBalance };
    }

    await query.send();

    updateLastTransfer(network, fromAddress, seqno);

    return {
      normalizedAddress, amount, seqno, encryptedComment,
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

export async function getAccountNewestTxId(accountId: string) {
  const { network } = parseAccountId(accountId);
  const address = await fetchStoredAddress(accountId);

  return fetchNewestTxId(network, address);
}

export async function getAccountTransactionSlice(
  accountId: string,
  fromTxId?: string,
  toTxId?: string,
  limit?: number,
) {
  const { network } = parseAccountId(accountId);
  const address = await fetchStoredAddress(accountId);

  let transactions = await fetchTransactions(
    network, address, limit ?? GET_TRANSACTIONS_LIMIT, fromTxId, toTxId,
  );

  transactions = await Promise.all(
    transactions.map((transaction) => parseWalletTransactionBody(network, transaction)),
  );

  return transactions
    .map(updateTransactionType)
    .map(updateTransactionMetadata)
    .map(omitExtraData);
}

export async function getMergedTransactionSlice(accountId: string, lastTxIds: ApiTxIdBySlug, limit: number) {
  // eslint-disable-next-line prefer-const
  let { toncoin: lastTonTxId, ...tokenLastTxIds } = lastTxIds;
  const tonTxs = await getAccountTransactionSlice(accountId, lastTonTxId, undefined, limit);

  if (!tonTxs.length) {
    return [];
  }

  lastTonTxId = tonTxs[tonTxs.length - 1].txId;
  const lastTonTxLt = parseTxId(lastTonTxId).lt;

  const results = await Promise.all(Object.entries(tokenLastTxIds).map(([slug, lastTxId]) => {
    if (lastTxId && parseTxId(lastTxId).lt < lastTonTxLt) {
      return [];
    }

    return getTokenTransactionSlice(accountId, slug, lastTxId, lastTonTxId, GET_TRANSACTIONS_MAX_LIMIT);
  }));

  const allTxs = [...tonTxs, ...results.flat()];
  allTxs.sort((a, b) => compareTransactions(a, b, false));

  return allTxs;
}

export async function getTokenTransactionSlice(
  accountId: string,
  tokenSlug: string,
  fromTxId?: string,
  toTxId?: string,
  limit?: number,
) {
  if (tokenSlug === TON_TOKEN_SLUG) {
    return getAccountTransactionSlice(accountId, fromTxId, toTxId, limit);
  }

  const { network } = parseAccountId(accountId);
  const address = await fetchStoredAddress(accountId);

  const minterAddress = resolveTokenBySlug(tokenSlug).minterAddress!;
  const tokenWalletAddress = await resolveTokenWalletAddress(network, address, minterAddress);

  const transactions = await fetchTransactions(
    network, tokenWalletAddress, limit ?? GET_TRANSACTIONS_LIMIT, fromTxId, toTxId,
  );

  const parsedTxs = transactions
    .map((tx) => parseTokenTransaction(tx, tokenSlug, address))
    .filter(Boolean)
    .map(updateTransactionMetadata)
    .map(omitExtraData);

  return parsedTxs.filter(Boolean);
}

function omitExtraData(tx: ApiTransactionExtra): ApiTransaction {
  return omit(tx, ['extraData']);
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

export async function checkMultiTransactionDraft(accountId: string, messages: TonTransferParams[]) {
  const { network } = parseAccountId(accountId);

  const result: {
    fee?: string;
    totalAmount?: string;
  } = {};

  let totalAmount: bigint = 0n;

  for (const { toAddress, amount } of messages) {
    if (BigInt(amount) < BigInt(0)) {
      return { ...result, error: ApiTransactionDraftError.InvalidAmount };
    }
    if (!Address.isValid(toAddress)) {
      return { ...result, error: ApiTransactionDraftError.InvalidToAddress };
    }
    totalAmount += BigInt(amount);
  }

  const wallet = await pickAccountWallet(accountId);

  if (!wallet) {
    return { ...result, error: ApiTransactionDraftError.Unexpected };
  }

  const { isInitialized, balance } = await getWalletInfo(network, wallet);

  result.fee = await calculateFee(isInitialized, async () => (await signMultiTransaction(
    network, wallet, messages,
  )).query);
  result.totalAmount = totalAmount.toString();

  if (BigInt(balance) < totalAmount + BigInt(result.fee)) {
    return { ...result, error: ApiTransactionDraftError.InsufficientBalance };
  }

  return result as { fee: string; totalAmount: string };
}

export async function submitMultiTransfer(
  accountId: string,
  password: string,
  messages: TonTransferParams[],
  expireAt?: number,
): Promise<SubmitMultiTransferResult> {
  const { network } = parseAccountId(accountId);

  try {
    const [wallet, fromAddress, privateKey] = await Promise.all([
      pickAccountWallet(accountId),
      fetchStoredAddress(accountId),
      fetchPrivateKey(accountId, password),
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

    const boc = bytesToBase64(await (await query.getQuery()).toBoc());

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
      boc,
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

  for (const message of messages) {
    if (message.payload && typeof message.payload === 'string' && message.isBase64Payload) {
      message.payload = parseBase64(message.payload);
    }
  }

  // TODO Uncomment after fixing types in tonweb
  // @ts-ignore
  const query = wallet.methods.transfers({
    secretKey: privateKey as any,
    seqno: seqno || 0,
    messages,
    sendMode: 3,
    expireAt,
  }) as Method;

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

export async function sendSignedMessage(accountId: string, message: ApiSignedTransfer) {
  const { network } = parseAccountId(accountId);
  const [fromAddress, publicKey, account] = await Promise.all([
    fetchStoredAddress(accountId),
    fetchStoredPublicKey(accountId),
    fetchStoredAccount(accountId),
  ]);
  const wallet = getTonWalletContract(publicKey!, account!.version!);
  const client = getTonClient(network);
  const contract = client.open(wallet);

  const { base64, seqno } = message;
  await contract.send(TonCell.fromBase64(base64));

  updateLastTransfer(network, fromAddress, seqno);
}

export async function sendSignedMessages(accountId: string, messages: ApiSignedTransfer[]) {
  const { network } = parseAccountId(accountId);
  const [fromAddress, publicKey, account] = await Promise.all([
    fetchStoredAddress(accountId),
    fetchStoredPublicKey(accountId),
    fetchStoredAccount(accountId),
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
  accountId: string, encryptedComment: string, fromAddress: string, password: string,
) {
  const keyPair = await fetchKeyPair(accountId, password);
  if (!keyPair) {
    return undefined;
  }

  const { secretKey, publicKey } = keyPair;

  const buffer = Buffer.from(encryptedComment, 'base64');

  return decryptMessageComment(buffer, publicKey, secretKey, fromAddress);
}

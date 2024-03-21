import type { OpenedContract } from '@ton/core';
import {
  beginCell, Cell, external, internal, SendMode, storeMessage,
} from '@ton/core';

import type {
  ApiActivity,
  ApiAnyDisplayError,
  ApiNetwork,
  ApiSignedTransfer,
  ApiTransaction,
  ApiTransactionActivity,
  ApiTransactionType,
  ApiTxIdBySlug,
} from '../../types';
import type { JettonWallet } from './contracts/JettonWallet';
import type { AnyPayload, ApiTransactionExtra, TonTransferParams } from './types';
import type { TonWallet } from './util/tonCore';
import { ApiCommonError, ApiTransactionDraftError, ApiTransactionError } from '../../types';

import { ONE_TON, TON_TOKEN_SLUG } from '../../../config';
import { parseAccountId } from '../../../util/account';
import { bigintMultiplyToNumber } from '../../../util/bigint';
import { compareActivities } from '../../../util/compareActivities';
import { omit } from '../../../util/iteratees';
import { isValidLedgerComment } from '../../../util/ledger/utils';
import { logDebugError } from '../../../util/logs';
import { pause } from '../../../util/schedulers';
import { isAscii } from '../../../util/stringFormat';
import withCacheAsync from '../../../util/withCacheAsync';
import { parseTxId } from './util';
import { fetchAddressBook, fetchLatestTxId, fetchTransactions } from './util/apiV3';
import { decryptMessageComment, encryptMessageComment } from './util/encryption';
import { parseWalletTransactionBody } from './util/metadata';
import {
  commentToBytes,
  getTonClient,
  getTonWalletContract,
  getWalletPublicKey,
  packBytesAsSnake,
  parseAddress,
  parseBase64,
  resolveTokenWalletAddress,
  toBase64Address,
} from './util/tonCore';
import { fetchStoredAccount, fetchStoredAddress } from '../../common/accounts';
import { getAddressInfo } from '../../common/addresses';
import { updateTransactionMetadata } from '../../common/helpers';
import { base64ToBytes, isKnownStakingPool } from '../../common/utils';
import { ApiServerError, handleServerError } from '../../errors';
import { resolveAddress } from './address';
import { fetchKeyPair, fetchPrivateKey } from './auth';
import {
  ATTEMPTS, FEE_FACTOR, STAKE_COMMENT, UNSTAKE_COMMENT,
} from './constants';
import { buildTokenTransfer, parseTokenTransaction, resolveTokenBySlug } from './tokens';
import {
  getContractInfo, getWalletBalance, getWalletInfo, pickAccountWallet,
} from './wallet';

export type CheckTransactionDraftResult = {
  fee?: bigint;
  addressName?: string;
  isScam?: boolean;
  resolvedAddress?: string;
  isToAddressNew?: boolean;
  error?: ApiAnyDisplayError;
};

export type SubmitTransferResult = {
  toAddress: string;
  amount: bigint;
  seqno: number;
  encryptedComment?: string;
} | {
  error: string;
};

type SubmitMultiTransferResult = {
  messages: TonTransferParams[];
  amount: string;
  seqno: number;
  boc: string;
} | {
  error: string;
};

const DEFAULT_EXPIRE_AT_TIMEOUT_SEC = 60; // 60 sec.
const GET_TRANSACTIONS_LIMIT = 50;
const GET_TRANSACTIONS_MAX_LIMIT = 100;
const WAIT_SEQNO_TIMEOUT = 40000; // 40 sec.
const WAIT_SEQNO_PAUSE = 5000; // 5 sec.
const WAIT_TRANSACTION_PAUSE = 500; // 0.5 sec.

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
  amount: bigint,
  data?: AnyPayload,
  stateInit?: Cell,
  shouldEncrypt?: boolean,
  isBase64Data?: boolean,
): Promise<CheckTransactionDraftResult> {
  const { network } = parseAccountId(accountId);

  const result: CheckTransactionDraftResult = {};

  try {
    const resolved = await resolveAddress(network, toAddress);
    if (resolved) {
      result.addressName = resolved.domain;
      toAddress = resolved.address;
    } else {
      return {
        ...result,
        error: ApiTransactionDraftError.DomainNotResolved,
      };
    }

    const {
      isValid, isUserFriendly, isTestOnly, isBounceable,
    } = parseAddress(toAddress);

    if (!isValid) {
      return {
        ...result,
        error: ApiTransactionDraftError.InvalidToAddress,
      };
    }

    const regex = /[+=/]/; // Temp check for `isUrlSafe`. Remove after TonWeb fixes the issue
    const isUrlSafe = !regex.test(toAddress);

    if (!isUserFriendly || !isUrlSafe || (network === 'mainnet' && isTestOnly)) {
      return {
        ...result,
        error: ApiTransactionDraftError.InvalidAddressFormat,
      };
    }

    const { isInitialized, isLedgerAllowed } = await getContractInfo(network, toAddress);

    if (isBounceable && !isInitialized) {
      result.isToAddressNew = !(await checkHasTransaction(network, toAddress));
      if (tokenSlug === TON_TOKEN_SLUG) {
        // Force non-bounceable for non-initialized recipients
        toAddress = toBase64Address(toAddress, false, network);
      }
    }

    result.resolvedAddress = toAddress;

    const addressInfo = await getAddressInfo(toBase64Address(toAddress, true));
    if (addressInfo?.name) result.addressName = addressInfo.name;
    if (addressInfo?.isScam) result.isScam = addressInfo.isScam;

    if (amount < 0n) {
      return {
        ...result,
        error: ApiTransactionDraftError.InvalidAmount,
      };
    }

    const wallet = await pickAccountWallet(accountId);
    if (!wallet) {
      return {
        ...result,
        error: ApiCommonError.Unexpected,
      };
    }

    if (typeof data === 'string' && isBase64Data) {
      data = base64ToBytes(data);
    }

    if (data && typeof data === 'string' && shouldEncrypt) {
      const toPublicKey = await getWalletPublicKey(network, toAddress);
      if (!toPublicKey) {
        return {
          ...result,
          error: ApiTransactionDraftError.WalletNotInitialized,
        };
      }
    }

    const account = await fetchStoredAccount(accountId);
    const isLedger = !!account.ledger;

    if (isLedger && !isLedgerAllowed) {
      return {
        ...result,
        error: ApiTransactionDraftError.UnsupportedHardwareContract,
      };
    }

    if (data && typeof data === 'string' && !isBase64Data && !isLedger) {
      data = commentToBytes(data);
    }

    if (tokenSlug === TON_TOKEN_SLUG) {
      if (data && isLedger && (typeof data !== 'string' || shouldEncrypt || !isValidLedgerComment(data))) {
        let error: ApiTransactionDraftError;
        if (typeof data !== 'string') {
          error = ApiTransactionDraftError.UnsupportedHardwareOperation;
        } else if (shouldEncrypt) {
          error = ApiTransactionDraftError.EncryptedDataNotSupported;
        } else {
          error = !isAscii(data)
            ? ApiTransactionDraftError.NonAsciiCommentForHardwareOperation
            : ApiTransactionDraftError.TooLongCommentForHardwareOperation;
        }

        return { ...result, error };
      }

      if (data instanceof Uint8Array) {
        data = packBytesAsSnake(data);
      }
    } else {
      const address = await fetchStoredAddress(accountId);
      const tokenAmount: bigint = amount;
      let tokenWallet: OpenedContract<JettonWallet>;
      ({
        tokenWallet,
        amount,
        toAddress,
        payload: data,
      } = await buildTokenTransfer(network, tokenSlug, address, toAddress, amount, data));

      const tokenBalance = await tokenWallet!.getJettonBalance();
      if (tokenBalance < tokenAmount!) {
        return {
          ...result,
          error: ApiTransactionDraftError.InsufficientBalance,
        };
      }
    }

    const { transaction } = await signTransaction(
      network, wallet, toAddress, amount, data, stateInit,
    );

    const realFee = await calculateFee(network, wallet, transaction, account.isInitialized);
    result.fee = bigintMultiplyToNumber(realFee, FEE_FACTOR);

    const balance = await getWalletBalance(network, wallet);

    if (balance < amount + realFee) {
      return {
        ...result,
        error: ApiTransactionDraftError.InsufficientBalance,
      };
    }

    return result as {
      fee: bigint;
      resolvedAddress: string;
      addressName?: string;
      isScam?: boolean;
      isToAddressNew?: boolean;
    };
  } catch (err: any) {
    return {
      ...handleServerError(err),
      ...result,
    };
  }
}

export async function submitTransfer(
  accountId: string,
  password: string,
  tokenSlug: string,
  toAddress: string,
  amount: bigint,
  data?: AnyPayload,
  stateInit?: Cell,
  shouldEncrypt?: boolean,
  isBase64Data?: boolean,
): Promise<SubmitTransferResult> {
  const { network } = parseAccountId(accountId);

  try {
    const [wallet, account, keyPair] = await Promise.all([
      pickAccountWallet(accountId),
      fetchStoredAccount(accountId),
      fetchKeyPair(accountId, password),
    ]);
    const { address: fromAddress } = account;
    const { publicKey, secretKey } = keyPair!;

    let encryptedComment: string | undefined;

    if (typeof data === 'string') {
      if (!data) {
        data = undefined;
      } else if (isBase64Data) {
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

    const { balance } = await getWalletInfo(network, wallet!);

    const { seqno, transaction } = await signTransaction(
      network, wallet!, toAddress, amount, data, stateInit, secretKey,
    );

    const fee = await calculateFee(network, wallet!, transaction, account.isInitialized);
    if (balance < amount + fee) {
      return { error: ApiTransactionError.InsufficientBalance };
    }

    await wallet!.send(transaction);

    updateLastTransfer(network, fromAddress, seqno);

    return {
      amount, seqno, encryptedComment, toAddress,
    };
  } catch (err: any) {
    logDebugError('submitTransfer', err);

    return { error: resolveTransactionError(err) };
  }
}

export function resolveTransactionError(error: any): ApiAnyDisplayError {
  if (error instanceof ApiServerError) {
    if (error.message.includes('exitcode=35,')) {
      return ApiTransactionError.IncorrectDeviceTime;
    } else if (error.displayError) {
      return error.displayError;
    }
  }
  return ApiTransactionError.UnsuccesfulTransfer;
}

async function signTransaction(
  network: ApiNetwork,
  wallet: TonWallet,
  toAddress: string,
  amount: bigint,
  payload?: AnyPayload,
  stateInit?: Cell,
  privateKey: Uint8Array = new Uint8Array(64),
) {
  const { seqno } = await getWalletInfo(network, wallet);

  if (payload instanceof Uint8Array) {
    payload = packBytesAsSnake(payload, 0) as Cell;
  }

  const init = stateInit ? {
    code: stateInit.refs[0],
    data: stateInit.refs[1],
  } : undefined;

  const transaction = wallet.createTransfer({
    seqno,
    secretKey: Buffer.from(privateKey),
    messages: [internal({
      value: amount,
      to: toAddress,
      body: payload,
      init,
      bounce: parseAddress(toAddress).isBounceable,
    })],
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
  });

  return { seqno, transaction };
}

export async function getAccountNewestTxId(accountId: string) {
  const { network } = parseAccountId(accountId);
  const address = await fetchStoredAddress(accountId);

  return fetchNewestTxId(network, address);
}

export async function getAccountTransactionSlice(
  accountId: string,
  toTxId?: string,
  fromTxId?: string,
  limit?: number,
) {
  const { network } = parseAccountId(accountId);
  const address = await fetchStoredAddress(accountId);

  let transactions = await fetchTransactions(
    network, address, limit ?? GET_TRANSACTIONS_LIMIT, toTxId, fromTxId,
  );

  transactions = await Promise.all(
    transactions.map((transaction) => parseWalletTransactionBody(network, transaction)),
  );

  return transactions
    .map(updateTransactionType)
    .map(updateTransactionMetadata)
    .map(omitExtraData)
    .map(transactionToActivity);
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
  allTxs.sort((a, b) => compareActivities(a, b));

  return allTxs;
}

export async function getTokenTransactionSlice(
  accountId: string,
  tokenSlug: string,
  toTxId?: string,
  fromTxId?: string,
  limit?: number,
): Promise<ApiTransactionActivity[]> {
  if (tokenSlug === TON_TOKEN_SLUG) {
    return getAccountTransactionSlice(accountId, toTxId, fromTxId, limit);
  }

  const { network } = parseAccountId(accountId);
  const address = await fetchStoredAddress(accountId);

  const minterAddress = resolveTokenBySlug(tokenSlug).minterAddress!;
  const tokenWalletAddress = await resolveTokenWalletAddress(network, address, minterAddress);

  const transactions = await fetchTransactions(
    network, tokenWalletAddress, limit ?? GET_TRANSACTIONS_LIMIT, toTxId, fromTxId,
  );

  return transactions
    .map((tx) => parseTokenTransaction(network, tx, tokenSlug, address))
    .filter(Boolean)
    .map(updateTransactionMetadata)
    .map(omitExtraData)
    .map(transactionToActivity);
}

function omitExtraData(tx: ApiTransactionExtra): ApiTransaction {
  return omit(tx, ['extraData']);
}

function updateTransactionType(transaction: ApiTransactionExtra) {
  const {
    comment, amount, extraData,
  } = transaction;

  const fromAddress = toBase64Address(transaction.fromAddress, true);
  const toAddress = toBase64Address(transaction.toAddress, true);

  let type: ApiTransactionType | undefined;

  if (isKnownStakingPool(fromAddress) && amount > ONE_TON) {
    type = 'unstake';
  } else if (isKnownStakingPool(toAddress)) {
    if (comment === STAKE_COMMENT) {
      type = 'stake';
    } else if (comment === UNSTAKE_COMMENT) {
      type = 'unstakeRequest';
    }
  } else if (extraData?.parsedPayload) {
    const payload = extraData.parsedPayload;

    if (payload.type === 'tokens:burn' && payload.isLiquidUnstakeRequest) {
      type = 'unstakeRequest';
    } else if (payload.type === 'liquid-staking:deposit') {
      type = 'stake';
    } else if (payload.type === 'liquid-staking:withdrawal' || payload.type === 'liquid-staking:withdrawal-nft') {
      type = 'unstake';
    }
  }

  return { ...transaction, type };
}

function transactionToActivity(transaction: ApiTransaction): ApiTransactionActivity {
  return {
    ...transaction,
    kind: 'transaction',
    id: transaction.txId,
  };
}

export async function checkMultiTransactionDraft(accountId: string, messages: TonTransferParams[]) {
  const { network } = parseAccountId(accountId);

  const result: {
    fee?: bigint;
    totalAmount?: bigint;
  } = {};

  let totalAmount: bigint = 0n;

  const account = await fetchStoredAccount(accountId);

  try {
    for (const { toAddress, amount } of messages) {
      if (amount < 0n) {
        return { ...result, error: ApiTransactionDraftError.InvalidAmount };
      }

      const isMainnet = network === 'mainnet';
      const { isValid, isTestOnly } = parseAddress(toAddress);

      if (!isValid || (isMainnet && isTestOnly)) {
        return { ...result, error: ApiTransactionDraftError.InvalidToAddress };
      }
      totalAmount += amount;
    }

    const wallet = await pickAccountWallet(accountId);

    if (!wallet) {
      return { ...result, error: ApiCommonError.Unexpected };
    }

    const { balance } = await getWalletInfo(network, wallet);

    const { transaction } = await signMultiTransaction(network, wallet, messages);

    const realFee = await calculateFee(network, wallet, transaction, account.isInitialized);
    result.totalAmount = totalAmount;
    result.fee = bigintMultiplyToNumber(realFee, FEE_FACTOR);

    if (balance < totalAmount + realFee) {
      return { ...result, error: ApiTransactionDraftError.InsufficientBalance };
    }

    return result as { fee: bigint; totalAmount: bigint };
  } catch (err: any) {
    return handleServerError(err);
  }
}

export async function submitMultiTransfer(
  accountId: string,
  password: string,
  messages: TonTransferParams[],
  expireAt?: number,
): Promise<SubmitMultiTransferResult> {
  const { network } = parseAccountId(accountId);

  try {
    const [wallet, account, privateKey] = await Promise.all([
      pickAccountWallet(accountId),
      fetchStoredAccount(accountId),
      fetchPrivateKey(accountId, password),
    ]);

    const { address: fromAddress } = account;

    let totalAmount = 0n;
    messages.forEach((message) => {
      totalAmount += BigInt(message.amount);
    });

    await waitLastTransfer(network, fromAddress);

    const { balance } = await getWalletInfo(network, wallet!);

    const { seqno, transaction, externalMessage } = await signMultiTransaction(
      network, wallet!, messages, privateKey, expireAt,
    );

    const boc = externalMessage.toBoc().toString('base64');

    const fee = await calculateFee(network, wallet!, transaction, account.isInitialized);
    if (BigInt(balance) < BigInt(totalAmount) + BigInt(fee)) {
      return { error: ApiTransactionError.InsufficientBalance };
    }

    await wallet!.send(transaction);

    updateLastTransfer(network, fromAddress, seqno);

    return {
      seqno,
      amount: totalAmount.toString(),
      messages,
      boc,
    };
  } catch (err) {
    logDebugError('submitMultiTransfer', err);
    return { error: resolveTransactionError(err) };
  }
}

async function signMultiTransaction(
  network: ApiNetwork,
  wallet: TonWallet,
  messages: TonTransferParams[],
  privateKey: Uint8Array = new Uint8Array(64),
  expireAt?: number,
) {
  const { seqno } = await getWalletInfo(network, wallet);
  if (!expireAt) {
    expireAt = Math.round(Date.now() / 1000) + DEFAULT_EXPIRE_AT_TIMEOUT_SEC;
  }

  const preparedMessages = messages.map((message) => {
    const {
      amount, toAddress, stateInit, isBase64Payload,
    } = message;
    let { payload } = message;

    if (isBase64Payload && typeof payload === 'string') {
      payload = Cell.fromBase64(payload);
    }

    const init = stateInit ? {
      code: stateInit.refs[0],
      data: stateInit.refs[1],
    } : undefined;

    return internal({
      value: amount,
      to: toAddress,
      body: payload as Cell | string | undefined, // TODO Fix Uint8Array type
      bounce: parseAddress(toAddress).isBounceable,
      init,
    });
  });

  const transaction = wallet.createTransfer({
    seqno,
    secretKey: Buffer.from(privateKey),
    messages: preparedMessages,
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    timeout: expireAt,
  });

  const externalMessage = toExternalMessage(wallet, seqno, transaction);

  return { seqno, transaction, externalMessage };
}

function toExternalMessage(
  contract: TonWallet,
  seqno: number,
  body: Cell,
) {
  return beginCell()
    .storeWritable(
      storeMessage(
        external({
          to: contract.address,
          init: seqno === 0 ? contract.init : undefined,
          body,
        }),
      ),
    )
    .endCell();
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

async function calculateFee(network: ApiNetwork, wallet: TonWallet, transaction: Cell, isInitialized?: boolean) {
  // eslint-disable-next-line no-null/no-null
  const { code = null, data = null } = !isInitialized ? wallet.init : {};

  const { source_fees: fees } = await getTonClient(network).estimateExternalMessageFee(wallet.address, {
    body: transaction,
    initCode: code,
    initData: data,
    ignoreSignature: true,
  });

  return BigInt(fees.in_fwd_fee + fees.storage_fee + fees.gas_fee + fees.fwd_fee);
}

export async function sendSignedMessage(accountId: string, message: ApiSignedTransfer) {
  const { network } = parseAccountId(accountId);
  const { address: fromAddress, publicKey, version } = await fetchStoredAccount(accountId);
  const wallet = getTonWalletContract(publicKey, version!);
  const client = getTonClient(network);
  const contract = client.open(wallet);

  const { base64, seqno } = message;
  await contract.send(Cell.fromBase64(base64));

  updateLastTransfer(network, fromAddress, seqno);
}

export async function sendSignedMessages(accountId: string, messages: ApiSignedTransfer[]) {
  const { network } = parseAccountId(accountId);
  const { address: fromAddress, publicKey, version } = await fetchStoredAccount(accountId);
  const wallet = getTonWalletContract(publicKey, version!);
  const client = getTonClient(network);
  const contract = client.open(wallet);

  const attempts = ATTEMPTS + messages.length;
  let index = 0;
  let attempt = 0;

  const firstExternalMessage = toExternalMessage(
    contract, messages[0].seqno, Cell.fromBase64(messages[0].base64),
  );

  while (index < messages.length && attempt < attempts) {
    const { base64, seqno } = messages[index];
    try {
      await waitLastTransfer(network, fromAddress);

      await contract.send(Cell.fromBase64(base64));

      updateLastTransfer(network, fromAddress, seqno);

      index++;
    } catch (err) {
      logDebugError('sendSignedMessages', err);
    }
    attempt++;
  }

  return { successNumber: index, externalMessage: firstExternalMessage };
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

export async function waitUntilTransactionAppears(network: ApiNetwork, address: string, txId: string) {
  const { lt } = parseTxId(txId);

  if (lt === 0) {
    return;
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const latestTxId = await fetchLatestTxId(network, address);
    if (latestTxId && parseTxId(latestTxId).lt >= lt) {
      return;
    }
    await pause(WAIT_TRANSACTION_PAUSE);
  }
}

export async function fetchNewestTxId(network: ApiNetwork, address: string) {
  const transactions = await fetchTransactions(network, address, 1);

  if (!transactions.length) {
    return undefined;
  }

  return transactions[0].txId;
}

export async function fixTokenActivitiesAddressForm(network: ApiNetwork, activities: ApiActivity[]) {
  const tokenAddresses: Set<string> = new Set();

  for (const activity of activities) {
    if (activity.kind === 'transaction' && activity.slug !== TON_TOKEN_SLUG) {
      tokenAddresses.add(activity.fromAddress);
      tokenAddresses.add(activity.toAddress);
    }
  }

  if (!tokenAddresses.size) {
    return;
  }

  const addressBook = await fetchAddressBook(network, Array.from(tokenAddresses));

  for (const activity of activities) {
    if (activity.kind === 'transaction' && activity.slug !== TON_TOKEN_SLUG) {
      activity.fromAddress = addressBook[activity.fromAddress].user_friendly;
      activity.toAddress = addressBook[activity.toAddress].user_friendly;
    }
  }
}

import {
  beginCell, Cell, external, internal, loadStateInit, SendMode, storeMessage,
} from '@ton/core';

import type { DieselStatus } from '../../../global/types';
import type { CheckTransactionDraftOptions } from '../../methods/types';
import type {
  ApiAccountWithMnemonic,
  ApiActivity,
  ApiAnyDisplayError,
  ApiNetwork,
  ApiNft,
  ApiSignedTransfer,
  ApiTransaction,
  ApiTransactionActivity,
  ApiTransactionType,
} from '../../types';
import type {
  AnyPayload,
  ApiCheckTransactionDraftResult,
  ApiSubmitMultiTransferResult,
  ApiSubmitTransferOptions,
  ApiSubmitTransferTonResult,
  ApiSubmitTransferWithDieselResult,
  ApiTransactionExtra,
  TonTransferParams,
} from './types';
import type { TonWallet } from './util/tonCore';
import { ApiCommonError, ApiTransactionDraftError, ApiTransactionError } from '../../types';

import {
  DEFAULT_FEE, DIESEL_ADDRESS, DIESEL_TOKENS, ONE_TON, TOKENS_WITH_STARS_FEE, TONCOIN,
} from '../../../config';
import { parseAccountId } from '../../../util/account';
import { bigintMultiplyToNumber } from '../../../util/bigint';
import { compareActivities } from '../../../util/compareActivities';
import { fromDecimal, toDecimal } from '../../../util/decimals';
import { buildCollectionByKey, omit } from '../../../util/iteratees';
import { logDebugError } from '../../../util/logs';
import { pause } from '../../../util/schedulers';
import withCacheAsync from '../../../util/withCacheAsync';
import { parseTxId } from './util';
import { fetchAddressBook, fetchLatestTxId, fetchTransactions } from './util/apiV3';
import { decryptMessageComment, encryptMessageComment } from './util/encryption';
import { buildNft, parseWalletTransactionBody } from './util/metadata';
import { sendExternal } from './util/sendExternal';
import { fetchNftItems } from './util/tonapiio';
import {
  commentToBytes,
  getTonClient,
  getTonWalletContract,
  getWalletPublicKey,
  packBytesAsSnake,
  packBytesAsSnakeForEncryptedData,
  parseAddress,
  parseBase64,
  resolveTokenWalletAddress,
  toBase64Address,
} from './util/tonCore';
import { fetchStoredAccount, fetchStoredTonWallet } from '../../common/accounts';
import { callBackendGet } from '../../common/backend';
import { updateTransactionMetadata } from '../../common/helpers';
import { getTokenByAddress, getTokenBySlug } from '../../common/tokens';
import { base64ToBytes, isKnownStakingPool } from '../../common/utils';
import { ApiServerError, handleServerError } from '../../errors';
import { createBody } from './walletV5/walletV5';
import { ActionSendMsg, packActionsList } from './walletV5/walletV5Actions';
import { resolveAddress } from './address';
import { fetchKeyPair, fetchPrivateKey } from './auth';
import {
  ATTEMPTS,
  FEE_FACTOR,
  STAKE_COMMENT,
  TINY_TOKEN_TRANSFER_AMOUNT,
  TRANSFER_TIMEOUT_SEC,
  UNSTAKE_COMMENT,
} from './constants';
import {
  buildTokenTransfer, parseTokenTransaction,
} from './tokens';
import {
  getContractInfo, getTonWallet,
  getWalletBalance, getWalletInfo,
} from './wallet';

const GET_TRANSACTIONS_LIMIT = 128;
const GET_TRANSACTIONS_MAX_LIMIT = 100;
const WAIT_TRANSFER_TIMEOUT = 5 * 60 * 1000; // 5 min
const WAIT_TRANSFER_PAUSE = 1000; // 1 sec.
const WAIT_TRANSACTION_PAUSE = 500; // 0.5 sec.

const MAX_BALANCE_WITH_CHECK_DIESEL = 100000000n; // 0.1 TON
const PENDING_DIESEL_TIMEOUT = 15 * 60 * 1000; // 15 min

const pendingTransfers: Record<string, {
  timestamp: number;
  seqno: number;
  promise: Promise<any>;
}> = {};

export const checkHasTransaction = withCacheAsync(async (network: ApiNetwork, address: string) => {
  const transactions = await fetchTransactions({ network, address, limit: 1 });
  return Boolean(transactions.length);
});

export async function checkTransactionDraft(
  options: CheckTransactionDraftOptions,
): Promise<ApiCheckTransactionDraftResult> {
  const {
    accountId,
    tokenAddress,
    shouldEncrypt,
    isBase64Data,
  } = options;
  let { toAddress, amount, data } = options;

  const { network } = parseAccountId(accountId);

  let result: ApiCheckTransactionDraftResult = {};

  try {
    result = await checkToAddress(network, toAddress);

    if ('error' in result) {
      return result;
    }

    toAddress = result.resolvedAddress!;

    const { isInitialized } = await getContractInfo(network, toAddress);

    if (options.stateInit && !isBase64Data) {
      return {
        ...result,
        error: ApiTransactionDraftError.StateInitWithoutBin,
      };
    }

    let stateInit;

    if (options.stateInit) {
      try {
        stateInit = Cell.fromBase64(options.stateInit);
      } catch {
        return {
          ...result,
          error: ApiTransactionDraftError.InvalidStateInit,
        };
      }
    }

    if (result.isBounceable && !isInitialized && !stateInit) {
      result.isToAddressNew = !(await checkHasTransaction(network, toAddress));
      return {
        ...result,
        error: ApiTransactionDraftError.InactiveContract,
      };
    }

    result.resolvedAddress = toAddress;

    if (amount < 0n) {
      return {
        ...result,
        error: ApiTransactionDraftError.InvalidAmount,
      };
    }

    const wallet = await getTonWallet(accountId);

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

    const { address, isInitialized: isWalletInitialized, version } = await fetchStoredTonWallet(accountId);

    if (data && typeof data === 'string' && !isBase64Data) {
      data = commentToBytes(data);
    }

    let tokenBalance = 0n;

    if (!tokenAddress) {
      if (data instanceof Uint8Array) {
        data = shouldEncrypt ? packBytesAsSnakeForEncryptedData(data) : packBytesAsSnake(data);
      }
    } else {
      const tokenAmount: bigint = amount;
      const tokenTransfer = await buildTokenTransfer({
        network,
        tokenAddress,
        fromAddress: address,
        toAddress,
        amount,
        payload: data,
      });

      ({ amount, toAddress, payload: data } = tokenTransfer);
      const { tokenWallet, isTokenWalletDeployed, mintlessTokenBalance } = tokenTransfer;

      if (isTokenWalletDeployed) {
        tokenBalance = await tokenWallet!.getJettonBalance();
      }

      if (mintlessTokenBalance) {
        tokenBalance += mintlessTokenBalance;
      }

      if (tokenBalance < tokenAmount!) {
        return {
          ...result,
          error: ApiTransactionDraftError.InsufficientBalance,
        };
      }
    }

    const { transaction } = await signTransaction({
      network,
      wallet,
      toAddress,
      amount,
      payload: data,
      stateInit,
      shouldEncrypt,
    });

    const realFee = await calculateFee(network, wallet, transaction, isWalletInitialized);
    result.fee = bigintMultiplyToNumber(realFee, FEE_FACTOR) + (tokenAddress ? amount : 0n);

    const toncoinBalance = await getWalletBalance(network, wallet);

    const isFullTonBalance = !tokenAddress && toncoinBalance === amount;
    const isEnoughBalance = isFullTonBalance
      ? toncoinBalance > realFee
      : toncoinBalance >= result.fee;

    if (
      network === 'mainnet'
      && tokenAddress
      && (DIESEL_TOKENS.has(tokenAddress) || TOKENS_WITH_STARS_FEE.has(tokenAddress))
      && toncoinBalance < MAX_BALANCE_WITH_CHECK_DIESEL
    ) {
      const isW5 = version === 'W5';
      const {
        status: dieselStatus,
        amount: dieselAmount,
        isAwaitingNotExpiredPrevious,
      } = await fetchEstimateDiesel(accountId, tokenAddress, isW5) || {};

      if (!isEnoughBalance || isAwaitingNotExpiredPrevious) {
        result.dieselStatus = dieselStatus;
        result.dieselAmount = dieselAmount;

        if (dieselStatus !== 'not-available') {
          return result;
        }
      }
    }

    if (!isEnoughBalance) {
      return {
        ...result,
        error: ApiTransactionDraftError.InsufficientBalance,
      };
    }

    return result;
  } catch (err: any) {
    return {
      ...handleServerError(err),
      ...result,
    };
  }
}

function estimateDiesel(address: string, tokenAddress: string, toncoinAmount: string, isW5: boolean) {
  return callBackendGet<{
    status: DieselStatus;
    amount?: string;
    pendingCreatedAt?: string;
  }>('/diesel/estimate', {
    address, tokenAddress, toncoinAmount, isW5,
  });
}

export async function checkToAddress(network: ApiNetwork, toAddress: string) {
  const result: {
    addressName?: string;
    isScam?: boolean;
    resolvedAddress?: string;
    isToAddressNew?: boolean;
    isBounceable?: boolean;
    isMemoRequired?: boolean;
  } = {};

  const resolved = await resolveAddress(network, toAddress);
  if (resolved) {
    result.addressName = resolved.name;
    result.resolvedAddress = resolved.address;
    result.isMemoRequired = resolved.isMemoRequired;
    result.isScam = resolved.isScam;
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

  result.isBounceable = isBounceable;

  if (!isValid) {
    return {
      ...result,
      error: ApiTransactionDraftError.InvalidToAddress,
    };
  }

  const regex = /[+=/]/;
  const isUrlSafe = !regex.test(toAddress);

  if (!isUserFriendly || !isUrlSafe || (network === 'mainnet' && isTestOnly)) {
    return {
      ...result,
      error: ApiTransactionDraftError.InvalidAddressFormat,
    };
  }

  return result;
}

export async function submitTransfer(options: ApiSubmitTransferOptions): Promise<ApiSubmitTransferTonResult> {
  const {
    accountId,
    password,
    tokenAddress,
    shouldEncrypt,
    isBase64Data,
  } = options;
  let { stateInit } = options;

  let { toAddress, amount, data } = options;

  const { network } = parseAccountId(accountId);

  try {
    const account = await fetchStoredAccount<ApiAccountWithMnemonic>(accountId);
    const { address: fromAddress, isInitialized } = account.ton;
    const wallet = await getTonWallet(accountId, account.ton);
    const { publicKey, secretKey } = (await fetchKeyPair(accountId, password, account))!;

    let encryptedComment: string | undefined;

    if (typeof data === 'string') {
      ({ payload: data, encryptedComment } = await stringToPayload({
        network, toAddress, fromAddress, data, secretKey, publicKey, shouldEncrypt, isBase64Data,
      }));
    }

    if (!tokenAddress) {
      if (data instanceof Uint8Array) {
        data = shouldEncrypt ? packBytesAsSnakeForEncryptedData(data) : packBytesAsSnake(data);
      }
    } else {
      ({
        amount,
        toAddress,
        payload: data,
        stateInit,
      } = await buildTokenTransfer({
        network,
        tokenAddress,
        fromAddress,
        toAddress,
        amount,
        payload: data,
      }));
    }

    await waitPendingTransfer(network, fromAddress);

    const { balance } = await getWalletInfo(network, wallet!);
    const isFullTonBalance = !tokenAddress && balance === amount;

    const { seqno, transaction } = await signTransaction({
      network,
      wallet,
      toAddress,
      amount,
      payload: data,
      stateInit,
      privateKey: secretKey,
      isFullBalance: isFullTonBalance,
      shouldEncrypt,
    });

    const fee = await calculateFee(network, wallet!, transaction, isInitialized);

    const isEnoughBalance = isFullTonBalance
      ? balance > fee
      : balance >= amount + fee;

    if (!isEnoughBalance) {
      return { error: ApiTransactionError.InsufficientBalance };
    }

    const client = getTonClient(network);
    const { msgHash, boc } = await sendExternal(client, wallet!, transaction);

    addPendingTransfer(network, fromAddress, seqno, boc);

    return {
      amount, seqno, encryptedComment, toAddress, msgHash,
    };
  } catch (err: any) {
    logDebugError('submitTransfer', err);

    return { error: resolveTransactionError(err) };
  }
}

export async function submitTransferWithDiesel(options: {
  accountId: string;
  password: string;
  toAddress: string;
  amount: bigint;
  data?: AnyPayload;
  tokenAddress: string;
  shouldEncrypt?: boolean;
  dieselAmount: bigint;
  isGaslessWithStars?: boolean;
}): Promise<ApiSubmitTransferWithDieselResult> {
  try {
    const {
      toAddress,
      amount,
      accountId,
      password,
      tokenAddress,
      shouldEncrypt,
      dieselAmount,
      isGaslessWithStars,
    } = options;

    let { data } = options;

    const { network } = parseAccountId(accountId);

    const [{ address: fromAddress, version }, keyPair] = await Promise.all([
      fetchStoredTonWallet(accountId),
      fetchKeyPair(accountId, password),
    ]);

    const { publicKey, secretKey } = keyPair!;

    let encryptedComment: string | undefined;

    if (typeof data === 'string') {
      ({ payload: data, encryptedComment } = await stringToPayload({
        network, toAddress, fromAddress, data, secretKey, publicKey, shouldEncrypt,
      }));
    }

    const messages: TonTransferParams[] = [
      omit(await buildTokenTransfer({
        network,
        tokenAddress,
        fromAddress,
        toAddress,
        amount,
        payload: data,
      }), ['tokenWallet']),
    ];

    if (!isGaslessWithStars) {
      messages.push(
        omit(await buildTokenTransfer({
          network,
          tokenAddress,
          fromAddress,
          toAddress: DIESEL_ADDRESS,
          amount: dieselAmount,
        }), ['tokenWallet']),
      );
    }

    let result;
    const gaslessType = version === 'W5' ? 'w5' : 'diesel';
    if (version === 'W5') {
      result = await submitMultiTransfer({
        accountId,
        password,
        messages,
        gaslessType,
      });
    } else {
      result = await submitMultiTransfer({
        accountId, password, messages, gaslessType,
      });
    }

    return { ...result, encryptedComment };
  } catch (err) {
    logDebugError('submitTransferWithDiesel', err);

    return { error: resolveTransactionError(err) };
  }
}

async function stringToPayload({
  network, toAddress, data, shouldEncrypt, publicKey, secretKey, fromAddress, isBase64Data,
}: {
  network: ApiNetwork;
  data: string;
  shouldEncrypt?: boolean;
  toAddress: string;
  publicKey: Uint8Array;
  secretKey: Uint8Array;
  fromAddress: string;
  isBase64Data?: boolean;
}): Promise<{
    payload?: Uint8Array | Cell;
    encryptedComment?: string;
  }> {
  let payload: Uint8Array | Cell | undefined;
  let encryptedComment: string | undefined;

  if (!data) {
    payload = undefined;
  } else if (isBase64Data) {
    payload = parseBase64(data);
  } else if (shouldEncrypt) {
    const toPublicKey = (await getWalletPublicKey(network, toAddress))!;
    payload = await encryptMessageComment(data, publicKey, toPublicKey, secretKey, fromAddress);
    encryptedComment = Buffer.from(payload.slice(4)).toString('base64');
  } else {
    payload = commentToBytes(data);
  }

  return { payload, encryptedComment };
}

export function resolveTransactionError(error: any): ApiAnyDisplayError | string {
  if (error instanceof ApiServerError) {
    if (error.message.includes('exitcode=35,')) {
      return ApiTransactionError.IncorrectDeviceTime;
    } else if (error.statusCode === 400) {
      return error.message;
    } else if (error.displayError) {
      return error.displayError;
    }
  }
  return ApiTransactionError.UnsuccesfulTransfer;
}

async function signTransaction({
  network,
  wallet,
  toAddress,
  amount,
  payload,
  stateInit,
  privateKey = new Uint8Array(64),
  isFullBalance,
  expireAt,
  shouldEncrypt,
}: {
  network: ApiNetwork;
  wallet: TonWallet;
  toAddress: string;
  amount: bigint;
  payload?: AnyPayload;
  stateInit?: Cell;
  privateKey?: Uint8Array;
  isFullBalance?: boolean;
  expireAt?: number;
  shouldEncrypt?: boolean;
}) {
  const { seqno } = await getWalletInfo(network, wallet);

  if (!expireAt) {
    expireAt = Math.round(Date.now() / 1000) + TRANSFER_TIMEOUT_SEC;
  }

  if (payload instanceof Uint8Array) {
    payload = shouldEncrypt
      ? packBytesAsSnakeForEncryptedData(payload) as Cell
      : packBytesAsSnake(payload, 0) as Cell;
  }

  const init = stateInit ? loadStateInit(
    stateInit.asSlice(),
  ) : undefined;

  const sendMode = isFullBalance
    ? SendMode.CARRY_ALL_REMAINING_BALANCE
    : SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS;

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
    sendMode,
    timeout: expireAt,
  });

  return { seqno, transaction };
}

export async function getAccountNewestTxId(accountId: string) {
  const { network } = parseAccountId(accountId);
  const { address } = await fetchStoredTonWallet(accountId);

  return fetchNewestTxId(network, address);
}

export async function fetchAccountTransactionSlice(
  accountId: string,
  toTimestamp?: number,
  fromTimestamp?: number,
  limit?: number,
) {
  const { network } = parseAccountId(accountId);
  const { address } = await fetchStoredTonWallet(accountId);

  let transactions = await fetchTransactions({
    network,
    address,
    limit: limit ?? GET_TRANSACTIONS_LIMIT,
    toTimestamp,
    fromTimestamp,
  });

  transactions = await Promise.all(
    transactions.map((transaction) => parseWalletTransactionBody(network, transaction)),
  );

  await populateTransactions(network, transactions);

  return transactions
    .map(updateTransactionType)
    .map(updateTransactionMetadata)
    .map(omitExtraData)
    .map(transactionToActivity);
}

async function populateTransactions(network: ApiNetwork, transactions: ApiTransactionExtra[]) {
  const nftAddresses = new Set<string>();
  const addressesForFixFormat = new Set<string>();

  for (const { extraData: { parsedPayload } } of transactions) {
    if (parsedPayload?.type === 'nft:ownership-assigned') {
      nftAddresses.add(parsedPayload.nftAddress);
      addressesForFixFormat.add(parsedPayload.prevOwner);
    } else if (parsedPayload?.type === 'nft:transfer') {
      nftAddresses.add(parsedPayload.nftAddress);
      addressesForFixFormat.add(parsedPayload.newOwner);
    }
  }

  if (nftAddresses.size) {
    const [rawNfts, addressBook] = await Promise.all([
      fetchNftItems(network, [...nftAddresses]),
      fetchAddressBook(network, [...addressesForFixFormat]),
    ]);

    const nfts = rawNfts
      .map((rawNft) => buildNft(network, rawNft))
      .filter(Boolean) as ApiNft[];

    const nftsByAddress = buildCollectionByKey(nfts, 'address');

    for (const transaction of transactions) {
      const { extraData: { parsedPayload } } = transaction;

      if (parsedPayload?.type === 'nft:ownership-assigned') {
        const nft = nftsByAddress[parsedPayload.nftAddress];
        transaction.nft = nft;
        if (nft?.isScam) {
          transaction.metadata = { ...transaction.metadata, isScam: true };
        } else {
          transaction.fromAddress = addressBook[parsedPayload.prevOwner].user_friendly;
        }
      } else if (parsedPayload?.type === 'nft:transfer') {
        const nft = nftsByAddress[parsedPayload.nftAddress];
        transaction.nft = nft;
        if (nft?.isScam) {
          transaction.metadata = { ...transaction.metadata, isScam: true };
        } else {
          transaction.toAddress = addressBook[parsedPayload.newOwner].user_friendly;
        }
      }
    }
  }
}

export async function getAllTransactionSlice(
  accountId: string,
  toTimestamp: number,
  limit: number,
  tokenSlugs: string[],
) {
  const tonTxs = await fetchAccountTransactionSlice(accountId, toTimestamp, undefined, limit);

  if (!tonTxs.length) {
    return [];
  }

  const fromTimestamp = tonTxs[tonTxs.length - 1].timestamp;

  const tokenResults = await Promise.all(tokenSlugs.map((slug) => {
    return fetchTokenTransactionSlice(
      accountId, slug, toTimestamp, fromTimestamp, GET_TRANSACTIONS_MAX_LIMIT, true,
    );
  }));

  const allTxs = [...tonTxs, ...tokenResults.flat()];
  allTxs.sort(compareActivities);

  return allTxs;
}

export async function fetchTokenTransactionSlice(
  accountId: string,
  tokenSlug: string,
  toTimestamp?: number,
  fromTimestamp?: number,
  limit?: number,
  shouldIncludeFrom?: boolean,
): Promise<ApiTransactionActivity[]> {
  if (tokenSlug === TONCOIN.slug) {
    return fetchAccountTransactionSlice(accountId, toTimestamp, fromTimestamp, limit);
  }

  const { network } = parseAccountId(accountId);
  const { address } = await fetchStoredTonWallet(accountId);

  const token = getTokenBySlug(tokenSlug);
  const { tokenAddress } = token;
  const tokenWalletAddress = await resolveTokenWalletAddress(network, address, tokenAddress!);

  const transactions = await fetchTransactions({
    network,
    address: tokenWalletAddress,
    limit: limit ?? GET_TRANSACTIONS_LIMIT,
    fromTimestamp,
    toTimestamp,
    shouldIncludeFrom,
  });

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
  const { amount, extraData } = transaction;
  let { comment } = transaction;

  const normalizedFromAddress = toBase64Address(transaction.fromAddress, true);
  const normalizedToAddress = toBase64Address(transaction.toAddress, true);

  let type: ApiTransactionType | undefined;

  if (isKnownStakingPool(normalizedFromAddress) && amount > ONE_TON) {
    type = 'unstake';
  } else if (isKnownStakingPool(normalizedToAddress)) {
    if (comment === STAKE_COMMENT) {
      type = 'stake';
    } else if (comment === UNSTAKE_COMMENT) {
      type = 'unstakeRequest';
    }
  } else if (extraData?.parsedPayload && !transaction.metadata?.isScam) {
    const payload = extraData.parsedPayload;

    if (payload.type === 'tokens:burn' && payload.isLiquidUnstakeRequest) {
      type = 'unstakeRequest';
    } else if (payload.type === 'liquid-staking:deposit') {
      type = 'stake';
    } else if (payload.type === 'liquid-staking:withdrawal' || payload.type === 'liquid-staking:withdrawal-nft') {
      type = 'unstake';
    } else if (payload.type === 'nft:transfer') {
      type = 'nftTransferred';
      comment = payload.comment;
    } else if (payload.type === 'nft:ownership-assigned') {
      type = 'nftReceived';
      comment = payload.comment;
    }
  }

  return {
    ...transaction,
    type,
    comment,
  };
}

function transactionToActivity(transaction: ApiTransaction): ApiTransactionActivity {
  return {
    ...transaction,
    kind: 'transaction',
    id: transaction.txId,
  };
}

export async function checkMultiTransactionDraft(
  accountId: string,
  messages: TonTransferParams[],
  withDiesel = false,
) {
  const { network } = parseAccountId(accountId);

  const result: {
    fee?: bigint;
    totalAmount?: bigint;
  } = {};

  let totalAmount: bigint = 0n;

  const { isInitialized } = await fetchStoredTonWallet(accountId);

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

    const wallet = await getTonWallet(accountId);

    if (!wallet) {
      return { ...result, error: ApiCommonError.Unexpected };
    }

    const { balance } = await getWalletInfo(network, wallet);

    const { transaction } = await signMultiTransaction(network, wallet, messages);

    const realFee = await calculateFee(network, wallet, transaction, isInitialized);

    // TODO Should be `0` for `withDiesel`?
    result.totalAmount = totalAmount;
    result.fee = bigintMultiplyToNumber(realFee, FEE_FACTOR);

    if (!withDiesel && balance < totalAmount + realFee) {
      return { ...result, error: ApiTransactionDraftError.InsufficientBalance };
    }

    return result as { fee: bigint; totalAmount: bigint };
  } catch (err: any) {
    return handleServerError(err);
  }
}

export type GaslessType = 'diesel' | 'w5';

interface SubmitMultiTransferOptions {
  accountId: string;
  password: string;
  messages: TonTransferParams[];
  expireAt?: number;
  gaslessType?: GaslessType;
}

export async function submitMultiTransfer({
  accountId, password, messages, expireAt, gaslessType,
}: SubmitMultiTransferOptions): Promise<ApiSubmitMultiTransferResult> {
  const { network } = parseAccountId(accountId);

  try {
    const account = await fetchStoredAccount<ApiAccountWithMnemonic>(accountId);
    const { address: fromAddress, isInitialized } = account.ton;
    const wallet = await getTonWallet(accountId, account.ton);
    const privateKey = await fetchPrivateKey(accountId, password, account);

    let totalAmount = 0n;
    messages.forEach((message) => {
      totalAmount += BigInt(message.amount);
    });

    await waitPendingTransfer(network, fromAddress);

    const { balance } = await getWalletInfo(network, wallet!);

    const isW5 = gaslessType === 'w5';
    const { seqno, transaction } = await signMultiTransaction(
      network, wallet!, messages, privateKey, expireAt, isW5,
    );

    if (!gaslessType) {
      const fee = await calculateFee(network, wallet!, transaction, isInitialized);
      if (balance < totalAmount + fee) {
        return { error: ApiTransactionError.InsufficientBalance };
      }
    }

    const client = getTonClient(network);
    const { msgHash, boc, paymentLink } = await sendExternal(
      client, wallet!, transaction, gaslessType,
    );

    if (!gaslessType) {
      addPendingTransfer(network, fromAddress, seqno, boc);
    }

    const clearedMessages = messages.map((message) => {
      if (typeof message.payload !== 'string' && typeof message.payload !== 'undefined') {
        return omit(message, ['payload']);
      }
      return message;
    });

    return {
      seqno,
      amount: totalAmount.toString(),
      messages: clearedMessages,
      boc,
      msgHash,
      paymentLink,
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
  withW5Diesel = false,
) {
  const { seqno } = await getWalletInfo(network, wallet);
  if (!expireAt) {
    expireAt = Math.round(Date.now() / 1000) + TRANSFER_TIMEOUT_SEC;
  }

  const preparedMessages = messages.map((message) => {
    const {
      amount, toAddress, stateInit, isBase64Payload,
    } = message;
    let { payload } = message;

    if (isBase64Payload && typeof payload === 'string') {
      payload = Cell.fromBase64(payload);
    }

    const init = stateInit ? loadStateInit(
      stateInit.asSlice(),
    ) : undefined;

    return internal({
      value: amount,
      to: toAddress,
      body: payload as Cell | string | undefined, // TODO Fix Uint8Array type
      bounce: parseAddress(toAddress).isBounceable,
      init,
    });
  });

  let transaction;
  if (withW5Diesel) {
    const actionList = packActionsList(preparedMessages.map(
      (msg) => new ActionSendMsg(SendMode.PAY_GAS_SEPARATELY, msg),
    ));

    transaction = createBody(
      actionList,
      seqno,
      Buffer.from(privateKey),
      PENDING_DIESEL_TIMEOUT,
    );
  } else {
    transaction = wallet.createTransfer({
      seqno,
      secretKey: Buffer.from(privateKey),
      messages: preparedMessages,
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
      timeout: expireAt,
    });
  }

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

function addPendingTransfer(network: ApiNetwork, address: string, seqno: number, boc: string) {
  const key = buildPendingTransferKey(network, address);
  const timestamp = Date.now();
  const promise = retrySendBoc({
    network, address, boc, seqno, timestamp,
  });

  pendingTransfers[key] = {
    timestamp,
    seqno,
    promise,
  };
}

async function retrySendBoc({
  network, address, boc, seqno, timestamp,
}: {
  network: ApiNetwork;
  address: string;
  boc: string;
  seqno: number;
  timestamp: number;
}) {
  const tonClient = getTonClient(network);
  const waitUntil = timestamp + WAIT_TRANSFER_TIMEOUT;

  while (Date.now() < waitUntil) {
    const error = await tonClient.sendFile(boc).catch((err) => String(err));

    // Errors mean that `seqno` was changed or not enough of balance
    if (error?.includes('exitcode=33') || error?.includes('inbound external message rejected by account')) {
      return;
    }

    await pause(WAIT_TRANSFER_PAUSE);
    const walletInfo = await getWalletInfo(network, address).catch(() => undefined);

    // seqno here may change before exit code appears
    if (walletInfo && walletInfo.seqno > seqno) {
      return;
    }

    await pause(WAIT_TRANSFER_PAUSE);
  }
}

export async function waitPendingTransfer(network: ApiNetwork, address: string) {
  const key = buildPendingTransferKey(network, address);
  const pendingTransfer = pendingTransfers[key];
  if (!pendingTransfer) return;

  await pendingTransfer.promise;

  delete pendingTransfers[key];
}

function buildPendingTransferKey(network: ApiNetwork, address: string) {
  return `${network}:${address}`;
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
  const { address: fromAddress, publicKey, version } = await fetchStoredTonWallet(accountId);
  const client = getTonClient(network);
  const wallet = client.open(getTonWalletContract(publicKey, version!));

  const { base64, seqno } = message;
  const { msgHash, boc } = await sendExternal(client, wallet, Cell.fromBase64(base64));

  addPendingTransfer(network, fromAddress, seqno, boc);

  return msgHash;
}

export async function sendSignedMessages(accountId: string, messages: ApiSignedTransfer[]) {
  const { network } = parseAccountId(accountId);
  const { address: fromAddress, publicKey, version } = await fetchStoredTonWallet(accountId);
  const client = getTonClient(network);
  const wallet = client.open(getTonWalletContract(publicKey, version!));

  const attempts = ATTEMPTS + messages.length;
  let index = 0;
  let attempt = 0;

  let firstBoc: string | undefined;

  const msgHashes: string[] = [];
  while (index < messages.length && attempt < attempts) {
    const { base64, seqno } = messages[index];
    try {
      await waitPendingTransfer(network, fromAddress);

      const { msgHash, boc } = await sendExternal(client, wallet, Cell.fromBase64(base64));
      msgHashes.push(msgHash);

      if (index === 0) {
        firstBoc = boc;
      }

      addPendingTransfer(network, fromAddress, seqno, boc);

      index++;
    } catch (err) {
      logDebugError('sendSignedMessages', err);
    }
    attempt++;
  }

  return { successNumber: index, firstBoc, msgHashes };
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
  const transactions = await fetchTransactions({ network, address, limit: 1 });

  if (!transactions.length) {
    return undefined;
  }

  return transactions[0].txId;
}

export async function fixTokenActivitiesAddressForm(network: ApiNetwork, activities: ApiActivity[]) {
  const tokenAddresses: Set<string> = new Set();

  for (const activity of activities) {
    if (activity.kind === 'transaction' && activity.slug !== TONCOIN.slug) {
      tokenAddresses.add(activity.fromAddress);
      tokenAddresses.add(activity.toAddress);
    }
  }

  if (!tokenAddresses.size) {
    return;
  }

  const addressBook = await fetchAddressBook(network, Array.from(tokenAddresses));

  for (const activity of activities) {
    if (activity.kind === 'transaction' && activity.slug !== TONCOIN.slug) {
      activity.fromAddress = addressBook[activity.fromAddress].user_friendly;
      activity.toAddress = addressBook[activity.toAddress].user_friendly;
    }
  }
}

export async function fetchEstimateDiesel(
  accountId: string, tokenAddress: string, isW5 = false,
) {
  const { network } = parseAccountId(accountId);
  if (network !== 'mainnet') return undefined;

  const wallet = await getTonWallet(accountId);
  if (!wallet) return undefined;

  const { address } = await fetchStoredTonWallet(accountId);
  const balance = await getWalletBalance(network, wallet);

  if (balance >= MAX_BALANCE_WITH_CHECK_DIESEL) return undefined;

  const multiplier = TOKENS_WITH_STARS_FEE.has(tokenAddress) ? 1n : 2n;
  const toncoinAmount = toDecimal((TINY_TOKEN_TRANSFER_AMOUNT + DEFAULT_FEE) * multiplier);

  const {
    status,
    amount,
    pendingCreatedAt,
  } = await estimateDiesel(address, tokenAddress, toncoinAmount, isW5);

  const { decimals } = getTokenByAddress(tokenAddress)!;

  const isAwaitingNotExpiredPrevious = Boolean(
    pendingCreatedAt
      && Date.now() - new Date(pendingCreatedAt).getTime() > PENDING_DIESEL_TIMEOUT,
  );

  return {
    status,
    amount: amount ? fromDecimal(amount, decimals) : undefined,
    pendingCreatedAt,
    isAwaitingNotExpiredPrevious,
  };
}

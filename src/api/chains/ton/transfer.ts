import { Cell, internal, loadStateInit, SendMode } from '@ton/core';
import { WalletContractV5R1 } from '@ton/ton/dist/wallets/WalletContractV5R1';

import type { DieselStatus } from '../../../global/types';
import type Deferred from '../../../util/Deferred';
import type { CheckTransactionDraftOptions } from '../../methods/types';
import type {
  ApiAccountWithMnemonic,
  ApiAnyDisplayError,
  ApiNetwork,
  ApiSignedTransfer,
  ApiToken,
} from '../../types';
import type {
  AnyPayload,
  ApiCheckMultiTransactionDraftResult,
  ApiCheckTransactionDraftResult,
  ApiEmulationWithFallbackResult,
  ApiFetchEstimateDieselResult,
  ApiSubmitMultiTransferResult,
  ApiSubmitTransferOptions,
  ApiSubmitTransferTonResult,
  ApiSubmitTransferWithDieselResult,
  ApiTonWalletVersion,
  TonTransferParams,
} from './types';
import type { TonWallet } from './util/tonCore';
import { ApiTransactionDraftError, ApiTransactionError } from '../../types';

import { DEFAULT_FEE, DIESEL_ADDRESS } from '../../../config';
import { parseAccountId } from '../../../util/account';
import { bigintMultiplyToNumber } from '../../../util/bigint';
import { fromDecimal, toDecimal } from '../../../util/decimals';
import { getDieselTokenAmount, isDieselAvailable } from '../../../util/fee/transferFee';
import { omit, pick } from '../../../util/iteratees';
import { logDebug, logDebugError } from '../../../util/logs';
import { pause } from '../../../util/schedulers';
import { decryptMessageComment, encryptMessageComment } from './util/encryption';
import { sendExternal } from './util/sendExternal';
import {
  commentToBytes,
  getOurFeePayload,
  getTonClient,
  getWalletPublicKey,
  packBytesAsSnake,
  packBytesAsSnakeForEncryptedData,
  parseAddress,
  parseBase64,
} from './util/tonCore';
import { fetchStoredAccount, fetchStoredTonWallet } from '../../common/accounts';
import { callBackendGet } from '../../common/backend';
import { getPendingTransfer, waitAndCreatePendingTransfer } from '../../common/pendingTransfers';
import { getTokenByAddress } from '../../common/tokens';
import { base64ToBytes } from '../../common/utils';
import { MINUTE, SEC } from '../../constants';
import { ApiServerError, handleServerError } from '../../errors';
import { checkHasTransaction, fetchNewestActionId } from './activities';
import { resolveAddress } from './address';
import { fetchKeyPair, fetchPrivateKey } from './auth';
import { ATTEMPTS, FEE_FACTOR, TRANSFER_TIMEOUT_SEC } from './constants';
import { emulateTransaction } from './emulation';
import {
  buildTokenTransfer,
  calculateTokenBalanceWithMintless,
  getTokenBalanceWithMintless,
  getToncoinAmountForTransfer,
} from './tokens';
import { buildWallet, getContractInfo, getTonWallet, getWalletBalance, getWalletInfo } from './wallet';

const WAIT_TRANSFER_TIMEOUT = MINUTE;
const WAIT_PAUSE = SEC;

const MAX_BALANCE_WITH_CHECK_DIESEL = 100000000n; // 0.1 TON
const PENDING_DIESEL_TIMEOUT_SEC = 15 * 60; // 15 min

const DIESEL_NOT_AVAILABLE: ApiFetchEstimateDieselResult = {
  status: 'not-available',
  nativeAmount: 0n,
  remainingFee: 0n,
  realFee: 0n,
};

export async function checkTransactionDraft(
  options: CheckTransactionDraftOptions,
): Promise<ApiCheckTransactionDraftResult> {
  const {
    accountId,
    amount = 0n,
    tokenAddress,
    shouldEncrypt,
    isBase64Data,
    stateInit: stateInitString,
    forwardAmount,
    allowGasless,
  } = options;
  let { toAddress, data } = options;

  const { network } = parseAccountId(accountId);

  let result: ApiCheckTransactionDraftResult = {};

  try {
    result = await checkToAddress(network, toAddress);
    if ('error' in result) {
      return result;
    }

    toAddress = result.resolvedAddress!;

    const { isInitialized } = await getContractInfo(network, toAddress);

    if (stateInitString && !isBase64Data) {
      return {
        ...result,
        error: ApiTransactionDraftError.StateInitWithoutBin,
      };
    }

    let stateInit;

    if (stateInitString) {
      try {
        stateInit = Cell.fromBase64(stateInitString);
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

    const { address, isInitialized: isWalletInitialized } = await fetchStoredTonWallet(accountId);

    if (data && typeof data === 'string' && !isBase64Data) {
      data = commentToBytes(data);
    }

    let toncoinAmount: bigint;
    const toncoinBalance = await getWalletBalance(network, wallet);
    let balance: bigint;
    let fee: bigint;
    let realFee: bigint;

    if (!tokenAddress) {
      balance = toncoinBalance;
      toncoinAmount = amount;
      fee = 0n;
      realFee = 0n;

      if (data instanceof Uint8Array) {
        data = shouldEncrypt ? packBytesAsSnakeForEncryptedData(data) : packBytesAsSnake(data);
      }
    } else {
      const tokenTransfer = await buildTokenTransfer({
        network,
        tokenAddress,
        fromAddress: address,
        toAddress,
        amount,
        payload: data,
        forwardAmount,
      });
      ({ amount: toncoinAmount, toAddress, payload: data } = tokenTransfer);
      const { realAmount: realToncoinAmount, isTokenWalletDeployed, mintlessTokenBalance } = tokenTransfer;

      // When the token is transferred, actually some TON is transferred, and the token sits inside the payload.
      // From the user perspective, this TON amount is a fee.
      fee = toncoinAmount;
      realFee = realToncoinAmount;

      const tokenWalletAddress = toAddress;
      balance = await calculateTokenBalanceWithMintless(
        network, tokenWalletAddress, isTokenWalletDeployed, mintlessTokenBalance,
      );
    }

    const isFullTonTransfer = !tokenAddress && toncoinBalance === amount;
    const { transaction } = await signTransaction({
      network,
      wallet,
      toAddress,
      amount: toncoinAmount,
      payload: data,
      stateInit,
      isFullBalance: isFullTonTransfer,
      shouldEncrypt,
    });
    // todo: Use `received` from the emulation to calculate the real fee. Check what happens when the receiver is the same wallet.
    const { networkFee } = applyFeeFactorToEmulationResult(
      await emulateTransactionWithFallback(network, wallet, transaction, isWalletInitialized),
    );
    fee += networkFee;
    realFee += networkFee;
    result.fee = fee;
    result.realFee = realFee;
    result.diesel = DIESEL_NOT_AVAILABLE;

    let isEnoughBalance: boolean;

    if (!tokenAddress) {
      isEnoughBalance = toncoinBalance >= fee + (isFullTonTransfer ? 0n : amount);
    } else {
      const canTransferGasfully = toncoinBalance >= fee;

      if (allowGasless) {
        result.diesel = await getDiesel({
          accountId,
          tokenAddress,
          canTransferGasfully,
          toncoinBalance,
          tokenBalance: balance,
        });
      }

      if (isDieselAvailable(result.diesel)) {
        isEnoughBalance = amount + getDieselTokenAmount(result.diesel) <= balance;
      } else {
        isEnoughBalance = canTransferGasfully && amount <= balance;
      }
    }

    return isEnoughBalance ? result : {
      ...result,
      error: ApiTransactionDraftError.InsufficientBalance,
    };
  } catch (err: any) {
    return {
      ...handleServerError(err),
      ...result,
    };
  }
}

function estimateDiesel(
  address: string,
  tokenAddress: string,
  toncoinAmount: string,
  isW5?: boolean,
  isStars?: boolean,
) {
  return callBackendGet<{
    status: DieselStatus;
    // The amount is defined only when the status is "available" or "stars-fee": https://github.com/mytonwallet-org/mytonwallet-backend/blob/44c1bf43fb776286152db8901b45fe8341752e35/src/endpoints/diesel.ts#L163
    amount?: string;
    pendingCreatedAt?: string;
  }>('/diesel/estimate', {
    address, tokenAddress, toncoinAmount, isW5, isStars,
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
  if (resolved === 'dnsNotResolved') return { ...result, error: ApiTransactionDraftError.DomainNotResolved };
  if (resolved === 'invalidAddress') return { ...result, error: ApiTransactionDraftError.InvalidToAddress };
  result.addressName = resolved.name;
  result.resolvedAddress = resolved.address;
  result.isMemoRequired = resolved.isMemoRequired;
  result.isScam = resolved.isScam;
  toAddress = resolved.address;

  const { isUserFriendly, isTestOnly, isBounceable } = parseAddress(toAddress);

  result.isBounceable = isBounceable;

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
    amount,
    tokenAddress,
    shouldEncrypt,
    isBase64Data,
    forwardAmount,
  } = options;
  let { stateInit } = options;

  let { toAddress, data } = options;

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

    let toncoinAmount: bigint;

    if (!tokenAddress) {
      toncoinAmount = amount;

      if (data instanceof Uint8Array) {
        data = shouldEncrypt ? packBytesAsSnakeForEncryptedData(data) : packBytesAsSnake(data);
      }
    } else {
      ({
        amount: toncoinAmount,
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
        forwardAmount,
      }));
    }

    const { pendingTransfer } = await waitAndCreatePendingTransfer(network, fromAddress);

    const toncoinBalance = await getWalletBalance(network, wallet);
    const isFullTonTransfer = !tokenAddress && toncoinBalance === amount;

    const { seqno, transaction } = await signTransaction({
      network,
      wallet,
      toAddress,
      amount: toncoinAmount,
      payload: data,
      stateInit,
      privateKey: secretKey,
      isFullBalance: isFullTonTransfer,
      shouldEncrypt,
    });

    const { networkFee } = await emulateTransactionWithFallback(network, wallet, transaction, isInitialized);

    const isEnoughBalance = isFullTonTransfer
      ? toncoinBalance > networkFee
      : toncoinBalance >= toncoinAmount + networkFee;

    if (!isEnoughBalance) {
      return { error: ApiTransactionError.InsufficientBalance };
    }

    const client = getTonClient(network);
    const { msgHash, boc, msgHashNormalized } = await sendExternal(client, wallet, transaction);

    void retrySendBoc(network, fromAddress, boc, seqno, pendingTransfer);

    return {
      amount,
      seqno,
      encryptedComment,
      toAddress,
      msgHash,
      msgHashNormalized,
      toncoinAmount,
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
      await buildTokenTransfer({
        network,
        tokenAddress,
        fromAddress,
        toAddress,
        amount,
        payload: data,
      }),
    ];

    if (!isGaslessWithStars) {
      messages.push(
        await buildTokenTransfer({
          network,
          tokenAddress,
          fromAddress,
          toAddress: DIESEL_ADDRESS,
          amount: dieselAmount,
          shouldSkipMintless: true,
          payload: getOurFeePayload(),
        }),
      );
    }

    const result = await submitMultiTransfer({
      accountId,
      password,
      messages,
      isGasless: true,
    });

    return {
      ...result,
      encryptedComment,
      withW5Gasless: version === 'W5',
    };
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
  privateKey,
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

  if (!privateKey) {
    privateKey = new Uint8Array(64);
  } else {
    logDebug('Signing transactions', { seqno, toAddress, amount });
  }

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

  const sendMode = (isFullBalance
    ? SendMode.CARRY_ALL_REMAINING_BALANCE
    : SendMode.PAY_GAS_SEPARATELY) + SendMode.IGNORE_ERRORS;

  const transferParams = {
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
  };
  const transaction = wallet instanceof WalletContractV5R1 // Otherwise, TypeScript emits an error
    ? wallet.createTransfer(transferParams)
    : wallet.createTransfer(transferParams);

  return { seqno, transaction };
}

export async function getAccountNewestActionId(accountId: string) {
  const { network } = parseAccountId(accountId);
  const { address } = await fetchStoredTonWallet(accountId);

  return fetchNewestActionId(network, address);
}

export async function checkMultiTransactionDraft(
  accountId: string,
  messages: TonTransferParams[],
  withDiesel?: boolean,
): Promise<ApiCheckMultiTransactionDraftResult> {
  let totalAmount: bigint = 0n;

  const { network } = parseAccountId(accountId);
  const tonWallet = await fetchStoredTonWallet(accountId);
  const { isInitialized, version } = tonWallet;

  try {
    for (const { toAddress, amount } of messages) {
      if (amount < 0n) {
        return { error: ApiTransactionDraftError.InvalidAmount };
      }

      const isMainnet = network === 'mainnet';
      const { isValid, isTestOnly } = parseAddress(toAddress);

      if (!isValid || (isMainnet && isTestOnly)) {
        return { error: ApiTransactionDraftError.InvalidToAddress };
      }
      totalAmount += amount;
    }

    const wallet = await getTonWallet(accountId, tonWallet);
    const { balance } = await getWalletInfo(network, wallet);

    const { transaction } = await signMultiTransaction({ network, wallet, messages, version });
    const emulation = applyFeeFactorToEmulationResult(
      await emulateTransactionWithFallback(network, wallet, transaction, isInitialized),
    );
    const result = { emulation };

    // TODO Should `totalAmount` be `0` for `withDiesel`?
    if (!withDiesel && balance < totalAmount + result.emulation.networkFee) {
      return { ...result, error: ApiTransactionDraftError.InsufficientBalance };
    }

    return result;
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
  isGasless?: boolean;
}

export async function submitMultiTransfer({
  accountId, password, messages, expireAt, isGasless,
}: SubmitMultiTransferOptions): Promise<ApiSubmitMultiTransferResult> {
  const { network } = parseAccountId(accountId);

  const account = await fetchStoredAccount<ApiAccountWithMnemonic>(accountId);
  const { address: fromAddress, isInitialized, version } = account.ton;
  const { pendingTransfer } = await waitAndCreatePendingTransfer(network, fromAddress);

  try {
    const wallet = await getTonWallet(accountId, account.ton);
    const privateKey = await fetchPrivateKey(accountId, password, account);

    let totalAmount = 0n;
    messages.forEach((message) => {
      totalAmount += BigInt(message.amount);
    });

    const { balance } = await getWalletInfo(network, wallet);

    const gaslessType = isGasless ? version === 'W5' ? 'w5' : 'diesel' : undefined;
    const withW5Gasless = gaslessType === 'w5';

    const { seqno, transaction } = await signMultiTransaction({
      network, wallet, messages, version, privateKey, expireAt, withW5Gasless,
    });

    if (!isGasless) {
      const { networkFee } = await emulateTransactionWithFallback(network, wallet, transaction, isInitialized);
      if (balance < totalAmount + networkFee) {
        return { error: ApiTransactionError.InsufficientBalance };
      }
    }

    const client = getTonClient(network);
    const { msgHash, boc, paymentLink, msgHashNormalized } = await sendExternal(
      client, wallet, transaction, gaslessType,
    );

    if (!isGasless) {
      void retrySendBoc(network, fromAddress, boc, seqno, pendingTransfer);
    } else {
      // TODO: Wait for gasless transfer
      pendingTransfer.resolve();
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
      msgHashNormalized,
      paymentLink,
      withW5Gasless,
    };
  } catch (err) {
    pendingTransfer.resolve();

    logDebugError('submitMultiTransfer', err);
    return { error: resolveTransactionError(err) };
  }
}

async function signMultiTransaction({
  network,
  wallet,
  messages,
  version,
  privateKey,
  expireAt,
  withW5Gasless,
}: {
  network: ApiNetwork;
  wallet: TonWallet;
  messages: TonTransferParams[];
  version: ApiTonWalletVersion;
  privateKey?: Uint8Array;
  /** Unix seconds */
  expireAt?: number;
  withW5Gasless?: boolean;
}) {
  const { seqno } = await getWalletInfo(network, wallet);

  if (!privateKey) {
    privateKey = new Uint8Array(64);
  } else {
    logDebug('Signing transaction', {
      seqno,
      messages: messages.map((msg) => pick(msg, ['toAddress', 'amount'])),
    });
  }

  if (!expireAt) {
    expireAt = Math.round(Date.now() / 1000) + (withW5Gasless ? PENDING_DIESEL_TIMEOUT_SEC : TRANSFER_TIMEOUT_SEC);
  }

  let hasPayload = false;

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

    if (!hasPayload && payload) {
      hasPayload = true;
    }

    return internal({
      value: amount,
      to: toAddress,
      body: payload as Cell | string | undefined, // TODO Fix Uint8Array type
      bounce: parseAddress(toAddress).isBounceable,
      init,
    });
  });

  if (version === 'W5') {
    // TODO Remove it. There is bug in @ton/ton library that causes transactions to be executed in reverse order.
    preparedMessages.reverse();
  }

  const transferParams = {
    authType: withW5Gasless ? 'internal' as const : undefined,
    seqno,
    secretKey: Buffer.from(privateKey),
    messages: preparedMessages,
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    timeout: expireAt,
  };

  const transaction = wallet instanceof WalletContractV5R1 // Otherwise, TypeScript emits an error
    ? wallet.createTransfer(transferParams)
    : wallet.createTransfer(transferParams);

  return { seqno, transaction };
}

async function retrySendBoc(
  network: ApiNetwork,
  address: string,
  boc: string,
  seqno: number,
  pendingTransfer?: Deferred,
) {
  const tonClient = getTonClient(network);
  const waitUntil = Date.now() + WAIT_TRANSFER_TIMEOUT;

  while (Date.now() < waitUntil) {
    const [error, walletInfo] = await Promise.all([
      tonClient.sendFile(boc).catch((err) => String(err)),
      getWalletInfo(network, address).catch(() => undefined),
    ]);

    // Errors mean that `seqno` was changed or not enough of balance
    if (error?.match(/(exitcode=33|exitcode=133|inbound external message rejected by account)/)) {
      break;
    }

    // seqno here may change before exit code appears
    if (walletInfo && walletInfo.seqno > seqno) {
      break;
    }

    await pause(WAIT_PAUSE);
  }

  pendingTransfer?.resolve();
}

async function emulateTransactionWithFallback(
  network: ApiNetwork,
  wallet: TonWallet,
  transaction: Cell,
  isInitialized?: boolean,
): Promise<ApiEmulationWithFallbackResult> {
  try {
    const emulation = await emulateTransaction(network, wallet, transaction, isInitialized);
    return { isFallback: false, ...emulation };
  } catch (err) {
    logDebugError('Failed to emulate a transaction', err);
  }

  // Falling back to the legacy fee estimation method just in case.
  // It doesn't support estimating more than 20 transactions (inside `transaction`) at once.
  // eslint-disable-next-line no-null/no-null
  const { code = null, data = null } = !isInitialized ? wallet.init : {};
  const { source_fees: fees } = await getTonClient(network).estimateExternalMessageFee(wallet.address, {
    body: transaction,
    initCode: code,
    initData: data,
    ignoreSignature: true,
  });
  const networkFee = BigInt(fees.in_fwd_fee + fees.storage_fee + fees.gas_fee + fees.fwd_fee);
  return { isFallback: true, networkFee };
}

export async function sendSignedMessage(accountId: string, message: ApiSignedTransfer, pendingTransferId?: string) {
  const { network } = parseAccountId(accountId);
  const { address: fromAddress, publicKey, version } = await fetchStoredTonWallet(accountId);
  const client = getTonClient(network);
  const wallet = buildWallet(publicKey!, version);
  const { base64, seqno } = message;
  const pendingTransfer = pendingTransferId ? getPendingTransfer(pendingTransferId) : undefined;

  try {
    const { msgHash, boc, msgHashNormalized } = await sendExternal(client, wallet, Cell.fromBase64(base64));

    void retrySendBoc(network, fromAddress, boc, seqno, pendingTransfer);

    return { boc, msgHash, msgHashNormalized };
  } catch (err) {
    pendingTransfer?.resolve();
    throw err;
  }
}

export async function sendSignedMessages(accountId: string, messages: ApiSignedTransfer[]) {
  const { network } = parseAccountId(accountId);
  const { address: fromAddress, publicKey, version } = await fetchStoredTonWallet(accountId);
  const client = getTonClient(network);
  const wallet = buildWallet(publicKey!, version);

  const attempts = ATTEMPTS + messages.length;
  let index = 0;
  let attempt = 0;

  let firstBoc: string | undefined;

  const msgHashes: string[] = [];
  const msgHashesNormalized: string[] = [];
  let pendingTransfer: Deferred | undefined;

  while (index < messages.length && attempt < attempts) {
    const { base64, seqno } = messages[index];
    try {
      ({ pendingTransfer } = await waitAndCreatePendingTransfer(network, fromAddress));

      const { msgHash, boc, msgHashNormalized } = await sendExternal(client, wallet, Cell.fromBase64(base64));
      msgHashes.push(msgHash);
      msgHashesNormalized.push(msgHashNormalized);

      if (index === 0) {
        firstBoc = boc;
      }

      void retrySendBoc(network, fromAddress, boc, seqno, pendingTransfer);

      index++;
    } catch (err) {
      pendingTransfer?.resolve();
      logDebugError('sendSignedMessages', err);
    }
    attempt++;
  }

  return { successNumber: index, firstBoc, msgHashes, msgHashesNormalized };
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

/**
 * The goal of the function is acting like `checkTransactionDraft` but return only the diesel information
 */
export function fetchEstimateDiesel(
  accountId: string, tokenAddress: string,
): Promise<ApiFetchEstimateDieselResult> {
  return getDiesel({
    accountId,
    tokenAddress,
    // We pass `false` because `fetchEstimateDiesel` assumes that the transfer is gasless anyway
    canTransferGasfully: false,
  });
}

/**
 * Decides whether the transfer must be gasless and fetches the diesel estimate from the backend.
 */
async function getDiesel({
  accountId,
  tokenAddress,
  canTransferGasfully,
  toncoinBalance,
  tokenBalance,
}: {
  accountId: string;
  tokenAddress: string;
  canTransferGasfully: boolean;
  // The below fields allow to avoid network requests if you already have these data
  toncoinBalance?: bigint;
  tokenBalance?: bigint;
}): Promise<ApiFetchEstimateDieselResult> {
  const { network } = parseAccountId(accountId);
  if (network !== 'mainnet') return DIESEL_NOT_AVAILABLE;

  const storedTonWallet = await fetchStoredTonWallet(accountId);
  const wallet = await getTonWallet(accountId, storedTonWallet);

  const token = getTokenByAddress(tokenAddress);
  if (!token.isGaslessEnabled && !token.isStarsEnabled) return DIESEL_NOT_AVAILABLE;

  const { address, version } = storedTonWallet;
  toncoinBalance ??= await getWalletBalance(network, wallet);
  const fee = getDieselToncoinFee(token);
  const toncoinNeeded = fee.amount - toncoinBalance;

  if (toncoinBalance >= MAX_BALANCE_WITH_CHECK_DIESEL || toncoinNeeded <= 0n) return DIESEL_NOT_AVAILABLE;

  const rawDiesel = await estimateDiesel(
    address,
    tokenAddress,
    toDecimal(toncoinNeeded),
    version === 'W5',
    fee.isStars,
  );
  const diesel: ApiFetchEstimateDieselResult = {
    status: rawDiesel.status,
    amount: rawDiesel.amount === undefined
      ? undefined
      : fromDecimal(rawDiesel.amount, rawDiesel.status === 'stars-fee' ? 0 : token.decimals),
    nativeAmount: toncoinNeeded,
    remainingFee: toncoinBalance,
    realFee: fee.realFee,
  };

  const tokenAmount = getDieselTokenAmount(diesel);
  if (tokenAmount === 0n) {
    return diesel;
  }

  tokenBalance ??= await getTokenBalanceWithMintless(network, address, tokenAddress);
  const canPayDiesel = tokenBalance >= tokenAmount;
  const isAwaitingNotExpiredPrevious = Boolean(
    rawDiesel.pendingCreatedAt
    && Date.now() - new Date(rawDiesel.pendingCreatedAt).getTime() < PENDING_DIESEL_TIMEOUT_SEC * SEC,
  );

  // When both TON and diesel are insufficient, we want to show the TON fee
  const shouldBeGasless = (!canTransferGasfully && canPayDiesel) || isAwaitingNotExpiredPrevious;
  return shouldBeGasless ? diesel : DIESEL_NOT_AVAILABLE;
}

/**
 * Guesses the total TON fee (including the gas attached to the transaction) that will be spent on a diesel transfer.
 *
 * `amount` is what will be taken from the wallet;
 * `realFee` is approximately what will be actually spent (the rest will return in the excess);
 * `isStars` tells whether the fee is estimated considering that the diesel will be paid in stars.
 */
function getDieselToncoinFee(token: ApiToken) {
  const isStars = !token.isGaslessEnabled && token.isStarsEnabled;
  let { amount, realAmount: realFee } = getToncoinAmountForTransfer(token, false);

  // Multiplying by 2 because the diesel transfer has 2 transactions:
  // - for the transfer itself,
  // - for sending the diesel to the MTW wallet.
  if (!isStars) {
    amount *= 2n;
    realFee *= 2n;
  }

  amount += DEFAULT_FEE;
  realFee += DEFAULT_FEE;

  return { amount, realFee, isStars };
}

function applyFeeFactorToEmulationResult(estimation: ApiEmulationWithFallbackResult): ApiEmulationWithFallbackResult {
  estimation = {
    ...estimation,
    networkFee: bigintMultiplyToNumber(estimation.networkFee, FEE_FACTOR),
  };

  if ('byTransactionIndex' in estimation) {
    estimation.byTransactionIndex = estimation.byTransactionIndex.map((transaction) => ({
      ...transaction,
      networkFee: bigintMultiplyToNumber(transaction.networkFee, FEE_FACTOR),
    }));
  }

  return estimation;
}

/* TonConnect specification https://github.com/ton-blockchain/ton-connect */

import { Cell } from '@ton/core';
import type {
  ConnectEventError,
  ConnectItemReply,
  ConnectRequest,
  DisconnectRpcRequest,
  DisconnectRpcResponse,
  SendTransactionRpcRequest,
  SendTransactionRpcResponse,
  SignDataPayload,
  SignDataRpcRequest,
  SignDataRpcResponse,
  SignDataRpcResponseSuccess,
  TonProofItem,
  TonProofItemReplySuccess,
  WalletResponseTemplateError,
} from '@tonconnect/protocol';

import type { ApiEmulationWithFallbackResult, TonTransferParams } from '../chains/ton/types';
import type {
  ApiAccountWithTon,
  ApiAnyDisplayError,
  ApiDapp,
  ApiDappConnectionType,
  ApiDappMetadata,
  ApiDappRequest,
  ApiDappTransfer,
  ApiNetwork,
  ApiSignedTransfer,
  ApiTonWallet,
  OnApiUpdate,
} from '../types';
import type {
  ApiDappRequestConfirmation,
  ApiTonConnectProof,
  ConnectEvent,
  TransactionPayload,
  TransactionPayloadMessage,
} from './types';
import { ApiCommonError, ApiTransactionError } from '../types';
import { CHAIN, CONNECT_EVENT_ERROR_CODES, SEND_TRANSACTION_ERROR_CODES } from './types';

import { IS_EXTENSION, TONCOIN } from '../../config';
import { parseAccountId } from '../../util/account';
import { areDeepEqual } from '../../util/areDeepEqual';
import { bigintDivideToNumber } from '../../util/bigint';
import { fetchJsonWithProxy } from '../../util/fetch';
import { pick } from '../../util/iteratees';
import { logDebugError } from '../../util/logs';
import safeExec from '../../util/safeExec';
import { getTonConnectMaxMessages, tonConnectGetDeviceInfo } from '../../util/tonConnectEnvironment';
import chains from '../chains';
import { fetchPrivateKey, getContractInfo, parsePayloadBase64 } from '../chains/ton';
import { getSigner } from '../chains/ton/util/signer';
import { getIsRawAddress, getWalletPublicKey, toBase64Address, toRawAddress } from '../chains/ton/util/tonCore';
import { fetchStoredTonAccount, getCurrentAccountId, getCurrentAccountIdOrFail } from '../common/accounts';
import { getKnownAddressInfo } from '../common/addresses';
import { createDappPromise } from '../common/dappPromises';
import { isUpdaterAlive } from '../common/helpers';
import { bytesToBase64, hexToBytes } from '../common/utils';
import * as apiErrors from '../errors';
import { ApiServerError } from '../errors';
import { callHook } from '../hooks';
import { signTonProof } from '../methods';
import { addDapp, deleteDapp, findLastConnectedAccount, getDapp, getDappsByUrl, updateDapp } from '../methods/dapps';
import { createLocalTransaction } from '../methods/transactions';
import * as errors from './errors';
import { UnknownAppError } from './errors';
import { getTransferActualToAddress, isTransferPayloadDangerous, isValidString, isValidUrl } from './utils';

const BLANK_GIF_DATA_URL = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

const ton = chains.ton;

let resolveInit: AnyFunction;
const initPromise = new Promise((resolve) => {
  resolveInit = resolve;
});

let onUpdate: OnApiUpdate;

export function initTonConnect(_onUpdate: OnApiUpdate) {
  onUpdate = _onUpdate;
  resolveInit();
}

export async function connect(request: ApiDappRequest, message: ConnectRequest, id: number): Promise<ConnectEvent> {
  try {
    await openExtensionPopup(true);

    onUpdate({
      type: 'dappLoading',
      connectionType: 'connect',
      isSse: request && 'sseOptions' in request,
    });

    const dappMetadata = await fetchDappMetadata(message.manifestUrl);
    const url = request.url || dappMetadata.url;
    const addressItem = message.items.find(({ name }) => name === 'ton_addr');
    const proofItem = message.items.find(({ name }) => name === 'ton_proof') as TonProofItem | undefined;
    const proof = proofItem ? {
      timestamp: Math.round(Date.now() / 1000),
      domain: new URL(url).host,
      payload: proofItem.payload,
    } : undefined;

    if (!addressItem) {
      throw new errors.BadRequestError('Missing \'ton_addr\'');
    }

    if (proof && !proof.domain.includes('.')) {
      throw new errors.BadRequestError('Invalid domain');
    }

    let accountId = await getCurrentAccountOrFail();

    const { promiseId, promise } = createDappPromise();

    const dapp: ApiDapp = {
      ...dappMetadata,
      url,
      connectedAt: Date.now(),
      ...(request.isUrlEnsured && { isUrlEnsured: true }),
      ...('sseOptions' in request && {
        sse: request.sseOptions,
      }),
    };

    onUpdate({
      type: 'dappConnect',
      identifier: 'identifier' in request ? request.identifier : undefined,
      promiseId,
      accountId,
      dapp,
      permissions: {
        address: true,
        proof: !!proof,
      },
      proof,
    });

    const promiseResult: ApiDappRequestConfirmation | string = await promise;

    accountId = typeof promiseResult == 'string' ? (await getCurrentAccountId())! : promiseResult.accountId;
    request.accountId = accountId;
    await addDapp(accountId, dapp);

    const account = await fetchStoredTonAccount(accountId);

    const deviceInfo = tonConnectGetDeviceInfo(account);
    const items: ConnectItemReply[] = [
      buildTonAddressReplyItem(accountId, account.ton),
    ];

    if (proof) {
      const proofSignature = typeof promiseResult == 'string'
        ? await signTonProof(accountId, proof, promiseResult)
        : promiseResult.proofSignature!;
      items.push(buildTonProofReplyItem(proof, proofSignature));
    }

    onUpdate({ type: 'updateDapps' });
    onUpdate({ type: 'dappConnectComplete' });

    return {
      event: 'connect',
      id,
      payload: {
        items,
        device: deviceInfo,
      },
    };
  } catch (err) {
    logDebugError('tonConnect:connect', err);

    safeExec(() => {
      onUpdate({
        type: 'dappCloseLoading',
        connectionType: 'connect',
      });
    });

    return formatConnectError(id, err as Error);
  }
}

export async function reconnect(request: ApiDappRequest, id: number): Promise<ConnectEvent> {
  try {
    const { url, accountId } = await ensureRequestParams(request);

    const currentDapp = await getDapp(accountId, url);
    if (!currentDapp) {
      throw new UnknownAppError();
    }

    await updateDapp(accountId, url, { connectedAt: Date.now() });

    const account = await fetchStoredTonAccount(accountId);

    const deviceInfo = tonConnectGetDeviceInfo(account);
    const items: ConnectItemReply[] = [
      buildTonAddressReplyItem(accountId, account.ton),
    ];

    return {
      event: 'connect',
      id,
      payload: {
        items,
        device: deviceInfo,
      },
    };
  } catch (e) {
    logDebugError('tonConnect:reconnect', e);
    return formatConnectError(id, e as Error);
  }
}

export async function disconnect(
  request: ApiDappRequest,
  message: DisconnectRpcRequest,
): Promise<DisconnectRpcResponse> {
  try {
    const { url, accountId } = await ensureRequestParams(request);

    await deleteDapp(accountId, url, true);
    onUpdate({ type: 'updateDapps' });
  } catch (err) {
    logDebugError('tonConnect:disconnect', err);
  }
  return {
    id: message.id,
    result: {},
  };
}

export async function sendTransaction(
  request: ApiDappRequest,
  message: SendTransactionRpcRequest,
): Promise<SendTransactionRpcResponse> {
  try {
    const { url, accountId } = await ensureRequestParams(request);
    const { network } = parseAccountId(accountId);

    const txPayload = JSON.parse(message.params[0]) as TransactionPayload;
    const { messages, network: dappNetworkRaw } = txPayload;

    const account = await fetchStoredTonAccount(accountId);
    const {
      type, ton: {
        address,
        publicKey: publicKeyHex,
      },
    } = account;

    const maxMessages = getTonConnectMaxMessages(account);

    if (messages.length > maxMessages) {
      throw new errors.BadRequestError(`Payload contains more than ${maxMessages} messages, which exceeds limit`);
    }

    const dappNetwork = dappNetworkRaw
      ? (dappNetworkRaw === CHAIN.MAINNET ? 'mainnet' : 'testnet')
      : undefined;
    let validUntil = txPayload.valid_until;
    if (validUntil && validUntil > 10 ** 10) {
      // If milliseconds were passed instead of seconds
      validUntil = Math.round(validUntil / 1000);
    }

    const isLedger = type === 'ledger';

    let vestingAddress: string | undefined;

    if (txPayload.from && toBase64Address(txPayload.from) !== toBase64Address(address)) {
      const publicKey = hexToBytes(publicKeyHex!);
      if (isLedger && await checkIsHisVestingWallet(network, publicKey, txPayload.from)) {
        vestingAddress = txPayload.from;
      } else {
        throw new errors.BadRequestError(undefined, ApiTransactionError.WrongAddress);
      }
    }

    if (dappNetwork && network !== dappNetwork) {
      throw new errors.BadRequestError(undefined, ApiTransactionError.WrongNetwork);
    }

    await openExtensionPopup(true);

    onUpdate({
      type: 'dappLoading',
      connectionType: 'sendTransaction',
      accountId,
      isSse: Boolean('sseOptions' in request && request.sseOptions),
    });

    const {
      preparedMessages,
      checkResult,
    } = await checkTransactionMessages(accountId, messages, network);

    if ('error' in checkResult) {
      throw new errors.BadRequestError(checkResult.error, checkResult.error);
    }

    const dapp = (await getDappsByUrl(accountId))[url];
    const transactionsForRequest = await prepareTransactionForRequest(network, messages, checkResult.emulation);

    const { promiseId, promise } = createDappPromise();

    onUpdate({
      type: 'dappSendTransactions',
      promiseId,
      accountId,
      dapp,
      transactions: transactionsForRequest,
      emulation: checkResult.emulation.isFallback ? undefined : pick(checkResult.emulation, ['activities', 'realFee']),
      validUntil,
      vestingAddress,
    });

    const response: string | ApiSignedTransfer[] = await promise;

    if (validUntil && validUntil < (Date.now() / 1000)) {
      throw new errors.BadRequestError('The confirmation timeout has expired');
    }

    let boc: string | undefined;
    let error: string | undefined;
    let msgHash: string | undefined;
    let msgHashNormalized: string | undefined;

    if (isLedger) {
      const signedTransfers = response as ApiSignedTransfer[];
      const submitResult = await ton.sendSignedMessages(accountId, signedTransfers);
      boc = submitResult.firstBoc;
      msgHash = submitResult.msgHashes[0];
      msgHashNormalized = submitResult.msgHashesNormalized[0];

      if (submitResult.successNumber > 0) {
        if (submitResult.successNumber < messages.length) {
          onUpdate({
            type: 'showError',
            error: ApiTransactionError.PartialTransactionFailure,
          });
        }
      } else {
        error = 'Failed transfers';
      }
    } else {
      const password = response as string;
      const submitResult = await ton.submitMultiTransfer({
        accountId, password, messages: preparedMessages, expireAt: validUntil,
      });
      if ('error' in submitResult) {
        error = submitResult.error;
      } else {
        ({ boc, msgHash, msgHashNormalized } = submitResult);
      }
    }

    if (error) {
      throw new errors.UnknownError(error);
    }

    transactionsForRequest.forEach(({ amount, normalizedAddress, payload, networkFee }, index) => {
      const comment = payload?.type === 'comment' ? payload.comment : undefined;
      createLocalTransaction(accountId, 'ton', {
        txId: msgHashNormalized!,
        amount,
        fromAddress: address,
        toAddress: normalizedAddress,
        comment,
        fee: networkFee,
        slug: TONCOIN.slug,
        externalMsgHash: msgHash,
      }, index);
    });

    return {
      result: boc!,
      id: message.id,
    };
  } catch (err) {
    logDebugError('tonConnect:sendTransaction', err);
    return handleMethodError(err, message.id, 'sendTransaction');
  }
}

function handleMethodError(
  err: unknown,
  messageId: string,
  connectionType: ApiDappConnectionType,
): WalletResponseTemplateError {
  safeExec(() => {
    onUpdate({
      type: 'dappCloseLoading',
      connectionType,
    });
  });

  let code = SEND_TRANSACTION_ERROR_CODES.UNKNOWN_ERROR;
  let errorMessage = 'Unhandled error';
  let displayError: ApiAnyDisplayError | undefined;

  if (err instanceof apiErrors.ApiUserRejectsError) {
    code = SEND_TRANSACTION_ERROR_CODES.USER_REJECTS_ERROR;
    errorMessage = err.message;
  } else if (err instanceof errors.TonConnectError) {
    code = err.code;
    errorMessage = err.message;
    displayError = err.displayError;
  } else if (err instanceof ApiServerError) {
    displayError = err.displayError;
  } else {
    displayError = ApiCommonError.Unexpected;
  }

  if (onUpdate && isUpdaterAlive(onUpdate) && displayError) {
    onUpdate({
      type: 'showError',
      error: displayError,
    });
  }
  return {
    error: {
      code,
      message: errorMessage,
    },
    id: messageId,
  };
}

async function checkIsHisVestingWallet(network: ApiNetwork, ownerPublicKey: Uint8Array, address: string) {
  const [info, publicKey] = await Promise.all([
    getContractInfo(network, address),
    getWalletPublicKey(network, address),
  ]);

  return info.contractInfo?.name === 'vesting' && areDeepEqual(ownerPublicKey, publicKey);
}

/**
 * See https://docs.tonconsole.com/academy/sign-data for more details
 */
export async function signData(
  request: ApiDappRequest,
  message: SignDataRpcRequest,
): Promise<SignDataRpcResponse> {
  try {
    const { url, accountId } = await ensureRequestParams(request);
    const account = await fetchStoredTonAccount(accountId);

    await openExtensionPopup(true);

    onUpdate({
      type: 'dappLoading',
      connectionType: 'signData',
      accountId,
      isSse: Boolean('sseOptions' in request && request.sseOptions),
    });

    const { promiseId, promise } = createDappPromise();
    const dapp = (await getDappsByUrl(accountId))[url];
    const payloadToSign = JSON.parse(message.params[0]) as SignDataPayload;

    onUpdate({
      type: 'dappSignData',
      promiseId,
      accountId,
      dapp,
      payloadToSign,
    });

    const password: string = await promise;

    return {
      result: await performSignData(
        accountId,
        account,
        dapp,
        payloadToSign,
        password,
      ),
      id: message.id,
    };
  } catch (err) {
    logDebugError('tonConnect:signData', err);
    return handleMethodError(err, message.id, 'signData');
  }
}

async function checkTransactionMessages(
  accountId: string,
  messages: TransactionPayloadMessage[],
  network: ApiNetwork,
) {
  const preparedMessages: TonTransferParams[] = messages.map((msg) => {
    const {
      address: toAddress,
      amount,
      payload,
      stateInit,
    } = msg;

    return {
      toAddress: getIsRawAddress(toAddress)
        ? toBase64Address(toAddress, true, network)
        : toAddress,
      amount: BigInt(amount),
      payload: payload ? Cell.fromBase64(payload) : undefined,
      stateInit: stateInit ? Cell.fromBase64(stateInit) : undefined,
    };
  });

  const checkResult = await ton.checkMultiTransactionDraft(accountId, preparedMessages);

  return {
    preparedMessages,
    checkResult,
  };
}

function prepareTransactionForRequest(
  network: ApiNetwork,
  messages: TransactionPayloadMessage[],
  emulation: ApiEmulationWithFallbackResult,
) {
  return Promise.all(messages.map(
    async ({
      address,
      amount: rawAmount,
      payload: rawPayload,
      stateInit,
    }, index): Promise<ApiDappTransfer> => {
      const amount = BigInt(rawAmount);
      const toAddress = getIsRawAddress(address) ? toBase64Address(address, true, network) : address;
      // Fix address format for `waitTxComplete` to work properly
      const normalizedAddress = toBase64Address(address, undefined, network);
      const payload = rawPayload ? await parsePayloadBase64(network, toAddress, rawPayload) : undefined;
      const { isScam } = getKnownAddressInfo(normalizedAddress) || {};
      const transferEmulation = emulation.isFallback ? undefined : emulation.byTransactionIndex[index];

      return {
        toAddress,
        amount,
        rawPayload,
        payload,
        stateInit,
        normalizedAddress,
        isScam,
        isDangerous: isTransferPayloadDangerous(payload),
        displayedToAddress: getTransferActualToAddress(toAddress, payload),
        networkFee: transferEmulation?.networkFee ?? bigintDivideToNumber(emulation.networkFee, messages.length),
      };
    },
  ));
}

function formatConnectError(id: number, error: Error): ConnectEventError {
  let code = CONNECT_EVENT_ERROR_CODES.UNKNOWN_ERROR;
  let message = 'Unhandled error';

  if (error instanceof apiErrors.ApiUserRejectsError) {
    code = CONNECT_EVENT_ERROR_CODES.USER_REJECTS_ERROR;
    message = error.message;
  } else if (error instanceof errors.TonConnectError) {
    code = error.code;
    message = error.message;
  }

  return {
    id,
    event: 'connect_error',
    payload: {
      code,
      message,
    },
  };
}

function buildTonAddressReplyItem(accountId: string, wallet: ApiTonWallet): ConnectItemReply {
  const { network } = parseAccountId(accountId);
  const { publicKey, address } = wallet;

  const stateInit = ton.getWalletStateInit(wallet);

  return {
    name: 'ton_addr',
    address: toRawAddress(address),
    network: network === 'mainnet' ? CHAIN.MAINNET : CHAIN.TESTNET,
    publicKey: publicKey!,
    walletStateInit: stateInit
      .toBoc({ idx: true, crc32: true })
      .toString('base64'),
  };
}

function buildTonProofReplyItem(proof: ApiTonConnectProof, signature: string): TonProofItemReplySuccess {
  const { timestamp, domain, payload } = proof;
  const domainBuffer = Buffer.from(domain);

  return {
    name: 'ton_proof',
    proof: {
      timestamp,
      domain: {
        lengthBytes: domainBuffer.byteLength,
        value: domainBuffer.toString('utf8'),
      },
      signature,
      payload,
    },
  };
}

async function performSignData(
  accountId: string,
  account: ApiAccountWithTon,
  dapp: ApiDapp,
  payloadToSign: SignDataPayload,
  password: string,
): Promise<SignDataRpcResponseSuccess['result']> {
  const privateKey = 'mnemonicEncrypted' in account
    ? await fetchPrivateKey(accountId, password, account)
    : undefined;
  const signer = getSigner(parseAccountId(accountId).network, account, privateKey);

  const timestamp = Math.floor(Date.now() / 1000);
  const domain = new URL(dapp.url).host;
  const signature = await signer.signData(timestamp, domain, payloadToSign);

  if ('error' in signature) {
    // Currently the only expected errors here are due to the Ledger rejection on not supporting SignData
    throw new errors.UserRejectsError(signature.error, signature.error);
  }

  return {
    signature: bytesToBase64(signature),
    address: account.ton.address,
    timestamp,
    domain,
    payload: payloadToSign,
  };
}

export async function fetchDappMetadata(manifestUrl: string): Promise<ApiDappMetadata> {
  try {
    const { url, name, iconUrl } = await fetchJsonWithProxy(manifestUrl);
    const safeIconUrl = (iconUrl.startsWith('data:') || iconUrl === '') ? BLANK_GIF_DATA_URL : iconUrl;
    if (!isValidUrl(url) || !isValidString(name) || !isValidUrl(safeIconUrl)) {
      throw new Error('Invalid data');
    }

    return {
      url,
      name,
      iconUrl: safeIconUrl,
      manifestUrl,
    };
  } catch (err) {
    logDebugError('fetchDapp', err);
    throw new errors.ManifestContentError();
  }
}

async function ensureRequestParams(
  request: ApiDappRequest,
): Promise<ApiDappRequest & { url: string; accountId: string }> {
  if (!request.url) {
    throw new errors.BadRequestError('Missing `url` in request');
  }

  if (request.accountId) {
    return request as ApiDappRequest & { url: string; accountId: string };
  }

  const { network } = parseAccountId(await getCurrentAccountIdOrFail());
  const lastAccountId = await findLastConnectedAccount(network, request.url);
  if (!lastAccountId) {
    throw new errors.BadRequestError('The connection is outdated, try relogin');
  }

  return {
    ...request,
    accountId: lastAccountId,
  } as ApiDappRequest & { url: string; accountId: string };
}

async function openExtensionPopup(force?: boolean) {
  if (!IS_EXTENSION || (!force && onUpdate && isUpdaterAlive(onUpdate))) {
    return false;
  }

  await callHook('onWindowNeeded');
  await initPromise;

  return true;
}

async function getCurrentAccountOrFail() {
  const accountId = await getCurrentAccountId();
  if (!accountId) {
    throw new errors.BadRequestError('The user is not authorized in the wallet');
  }
  return accountId;
}

import { Address, Cell } from '@ton/core';
import type {
  ConnectEventError,
  ConnectItemReply,
  ConnectRequest,
  DisconnectRpcRequest,
  DisconnectRpcResponse,
  SendTransactionRpcRequest,
  SendTransactionRpcResponse,
  SignDataRpcRequest,
  TonProofItem,
  TonProofItemReplySuccess,
} from '@tonconnect/protocol';
import { CHAIN } from '@tonconnect/protocol';
import nacl from 'tweetnacl';

import type {
  ApiAccountWithMnemonic,
  ApiAnyDisplayError,
  ApiDappMetadata,
  ApiDappRequest,
  ApiNetwork,
  ApiSignedTransfer,
  ApiTonWallet,
  OnApiUpdate,
} from '../types';
import type {
  ApiTonConnectProof, LocalConnectEvent, TransactionPayload, TransactionPayloadMessage,
} from './types';
import { ApiCommonError, ApiTransactionError } from '../types';
import { CONNECT_EVENT_ERROR_CODES, SEND_TRANSACTION_ERROR_CODES, SIGN_DATA_ERROR_CODES } from './types';

import { IS_EXTENSION, TONCOIN } from '../../config';
import { parseAccountId } from '../../util/account';
import { areDeepEqual } from '../../util/areDeepEqual';
import { logDebugError } from '../../util/logs';
import { fetchJsonMetadata } from '../../util/metadata';
import safeExec from '../../util/safeExec';
import chains from '../chains';
import { getContractInfo, parsePayloadBase64 } from '../chains/ton';
import { fetchKeyPair } from '../chains/ton/auth';
import {
  getIsRawAddress, getWalletPublicKey, toBase64Address, toRawAddress,
} from '../chains/ton/util/tonCore';
import {
  fetchStoredAccount,
  getCurrentAccountId,
  getCurrentAccountIdOrFail,
} from '../common/accounts';
import { getKnownAddressInfo } from '../common/addresses';
import { createDappPromise } from '../common/dappPromises';
import { isUpdaterAlive } from '../common/helpers';
import { bytesToBase64, hexToBytes, sha256 } from '../common/utils';
import * as apiErrors from '../errors';
import { ApiServerError } from '../errors';
import { callHook } from '../hooks';
import {
  activateDapp,
  addDapp,
  deactivateAccountDapp,
  deactivateDapp,
  deleteDapp,
  findLastConnectedAccount,
  getDapp,
  getDappsByOrigin,
  updateDapp,
} from '../methods/dapps';
import { createLocalTransaction } from '../methods/transactions';
import * as errors from './errors';
import { UnknownAppError } from './errors';
import { isValidString, isValidUrl } from './utils';

const BLANK_GIF_DATA_URL = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

const ton = chains.ton;

let resolveInit: AnyFunction;
const initPromise = new Promise((resolve) => {
  resolveInit = resolve;
});

let onPopupUpdate: OnApiUpdate;

export function initTonConnect(_onPopupUpdate: OnApiUpdate) {
  onPopupUpdate = _onPopupUpdate;
  resolveInit();
}

export async function connect(
  request: ApiDappRequest,
  message: ConnectRequest,
  id: number,
): Promise<LocalConnectEvent> {
  try {
    await openExtensionPopup(true);

    onPopupUpdate({
      type: 'dappLoading',
      connectionType: 'connect',
      isSse: request && 'sseOptions' in request,
    });

    const dappMetadata = await fetchDappMetadata(message.manifestUrl);

    if (!IS_EXTENSION) {
      request.origin = dappMetadata.origin;
    }

    const { origin } = await validateRequest(request, true);

    const addressItem = message.items.find(({ name }) => name === 'ton_addr');
    const proofItem = message.items.find(({ name }) => name === 'ton_proof') as TonProofItem | undefined;
    const proof = proofItem ? {
      timestamp: Math.round(Date.now() / 1000),
      domain: new URL(origin).host,
      payload: proofItem.payload,
    } : undefined;

    if (!addressItem) {
      throw new errors.BadRequestError("Missing 'ton_addr'");
    }

    let accountId = await getCurrentAccountOrFail();

    const { promiseId, promise } = createDappPromise();

    const dapp = {
      ...dappMetadata,
      origin,
      connectedAt: Date.now(),
      ...('sseOptions' in request && {
        sse: request.sseOptions,
      }),
    };

    onPopupUpdate({
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

    const promiseResult: {
      accountId?: string;
      password?: string;
      signature?: string;
    } | undefined = await promise;

    accountId = promiseResult!.accountId!;
    request.accountId = accountId;
    await addDapp(accountId, dapp);
    activateDapp(accountId, origin);

    const account = await fetchStoredAccount<ApiAccountWithMnemonic>(accountId);
    const { address } = account.ton;

    const items: ConnectItemReply[] = [
      await buildTonAddressReplyItem(accountId, account.ton),
    ];

    if (proof) {
      const { password, signature } = promiseResult!;

      let proofReplyItem: TonProofItemReplySuccess;
      if (password) {
        proofReplyItem = await signTonProof(accountId, account, password, address, proof!);
      } else {
        proofReplyItem = buildTonProofReplyItem(proof, signature!);
      }

      items.push(proofReplyItem);
    }

    onPopupUpdate({ type: 'updateDapps' });
    onPopupUpdate({ type: 'dappConnectComplete' });

    return {
      event: 'connect',
      id,
      payload: { items },
    };
  } catch (err) {
    logDebugError('tonConnect:connect', err);

    safeExec(() => {
      onPopupUpdate({
        type: 'dappCloseLoading',
      });
    });

    return formatConnectError(id, err as Error);
  }
}

export async function reconnect(request: ApiDappRequest, id: number): Promise<LocalConnectEvent> {
  try {
    const { origin, accountId } = await validateRequest(request);

    activateDapp(accountId, origin);
    const currentDapp = await getDapp(accountId, origin);
    if (!currentDapp) {
      throw new UnknownAppError();
    }

    await updateDapp(accountId, origin, { connectedAt: Date.now() });

    const account = await fetchStoredAccount<ApiAccountWithMnemonic>(accountId);

    const items: ConnectItemReply[] = [
      await buildTonAddressReplyItem(accountId, account.ton),
    ];

    return {
      event: 'connect',
      id,
      payload: { items },
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
    const { origin, accountId } = await validateRequest(request);

    await deleteDapp(accountId, origin, true);
    deactivateAccountDapp(accountId);
    onPopupUpdate({ type: 'updateDapps' });
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
    const { origin, accountId } = await validateRequest(request);
    const { network } = parseAccountId(accountId);

    const txPayload = JSON.parse(message.params[0]) as TransactionPayload;
    const { messages, network: dappNetworkRaw } = txPayload;

    if (messages.length > 4) {
      throw new errors.BadRequestError('Payload contains more than 4 messages, which exceeds limit');
    }

    const dappNetwork = dappNetworkRaw
      ? (dappNetworkRaw === CHAIN.MAINNET ? 'mainnet' : 'testnet')
      : undefined;
    let validUntil = txPayload.valid_until;
    if (validUntil && validUntil > 10 ** 10) {
      // If milliseconds were passed instead of seconds
      validUntil = Math.round(validUntil / 1000);
    }

    const {
      type, ton: {
        address,
        publicKey: publicKeyHex,
      },
    } = await fetchStoredAccount(accountId);

    const isLedger = type === 'ledger';

    let vestingAddress: string | undefined;

    if (txPayload.from && toBase64Address(txPayload.from) !== toBase64Address(address)) {
      const publicKey = hexToBytes(publicKeyHex);
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

    onPopupUpdate({
      type: 'dappLoading',
      connectionType: 'sendTransaction',
      accountId,
      isSse: Boolean('sseOptions' in request && request.sseOptions),
    });

    const {
      preparedMessages,
      checkResult,
    } = await checkTransactionMessages(accountId, messages, network);

    const dapp = (await getDappsByOrigin(accountId))[origin];
    const transactionsForRequest = await prepareTransactionForRequest(network, messages);

    const { promiseId, promise } = createDappPromise();

    onPopupUpdate({
      type: 'dappSendTransactions',
      promiseId,
      accountId,
      dapp,
      transactions: transactionsForRequest,
      fee: checkResult.fee!,
      vestingAddress,
    });

    // eslint-disable-next-line prefer-const
    const response: string | ApiSignedTransfer[] = await promise;

    if (validUntil && validUntil < (Date.now() / 1000)) {
      throw new errors.BadRequestError('The confirmation timeout has expired');
    }

    let boc: string | undefined;
    let successNumber: number | undefined;
    let error: string | undefined;
    let msgHashes: string[] = [];

    if (isLedger) {
      const signedTransfers = response as ApiSignedTransfer[];
      const submitResult = await ton.sendSignedMessages(accountId, signedTransfers);
      boc = submitResult.firstBoc;
      successNumber = submitResult.successNumber;
      msgHashes = submitResult.msgHashes;

      if (successNumber > 0) {
        if (successNumber < messages.length) {
          onPopupUpdate({
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
        boc = submitResult.boc;
        successNumber = messages.length;
        msgHashes = [submitResult.msgHash];
      }
    }

    if (error) {
      throw new errors.UnknownError(error);
    }

    const successTransactions = transactionsForRequest.slice(0, successNumber!);

    successTransactions.forEach(({ amount, normalizedAddress, payload }, index) => {
      const comment = payload?.type === 'comment' ? payload.comment : undefined;
      const msgHash = isLedger ? msgHashes[index] : msgHashes[0];
      createLocalTransaction(accountId, 'ton', {
        amount,
        fromAddress: address,
        toAddress: normalizedAddress,
        comment,
        fee: checkResult.fee!,
        slug: TONCOIN.slug,
        inMsgHash: msgHash,
      });
    });

    return {
      result: boc!,
      id: message.id,
    };
  } catch (err) {
    logDebugError('tonConnect:sendTransaction', err);

    safeExec(() => {
      onPopupUpdate({
        type: 'dappCloseLoading',
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

    if (onPopupUpdate && isUpdaterAlive(onPopupUpdate) && displayError) {
      onPopupUpdate({
        type: 'showError',
        error: displayError,
      });
    }
    return {
      error: {
        code,
        message: errorMessage,
      },
      id: message.id,
    };
  }
}

async function checkIsHisVestingWallet(network: ApiNetwork, ownerPublicKey: Uint8Array, address: string) {
  const [info, publicKey] = await Promise.all([
    getContractInfo(network, address),
    getWalletPublicKey(network, address),
  ]);

  return info.contractInfo?.name === 'vesting' && areDeepEqual(ownerPublicKey, publicKey);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function signData(request: ApiDappRequest, message: SignDataRpcRequest) {
  return {
    error: {
      code: SIGN_DATA_ERROR_CODES.METHOD_NOT_SUPPORTED,
      message: 'Method not supported',
    },
    id: message.id,
  };
}

async function checkTransactionMessages(accountId: string, messages: TransactionPayloadMessage[], network: ApiNetwork) {
  const preparedMessages = messages.map((msg) => {
    const {
      address,
      amount,
      payload,
      stateInit,
    } = msg;

    return {
      toAddress: getIsRawAddress(address) ? toBase64Address(address, true, network) : address,
      amount: BigInt(amount),
      payload: payload ? Cell.fromBase64(payload) : undefined,
      stateInit: stateInit ? Cell.fromBase64(stateInit) : undefined,
    };
  });

  const checkResult = await ton.checkMultiTransactionDraft(accountId, preparedMessages);
  if ('error' in checkResult) {
    onPopupUpdate({
      type: 'showError',
      error: checkResult.error,
    });
    throw new errors.BadRequestError(checkResult.error);
  }

  return {
    preparedMessages,
    checkResult,
  };
}

function prepareTransactionForRequest(network: ApiNetwork, messages: TransactionPayloadMessage[]) {
  return Promise.all(messages.map(
    async ({
      address,
      amount,
      payload: rawPayload,
      stateInit,
    }) => {
      const toAddress = getIsRawAddress(address) ? toBase64Address(address, true, network) : address;
      // Fix address format for `waitTxComplete` to work properly
      const normalizedAddress = toBase64Address(address, undefined, network);
      const payload = rawPayload ? await parsePayloadBase64(network, toAddress, rawPayload) : undefined;
      const { isScam } = getKnownAddressInfo(normalizedAddress) || {};

      return {
        toAddress,
        amount: BigInt(amount),
        rawPayload,
        payload,
        stateInit,
        normalizedAddress,
        isScam,
      };
    },
  ));
}

export async function deactivate(request: ApiDappRequest) {
  try {
    const { origin } = await validateRequest(request, true);

    deactivateDapp(origin);
  } catch (err) {
    logDebugError('tonConnect:deactivate', err);
  }
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

async function buildTonAddressReplyItem(accountId: string, wallet: ApiTonWallet): Promise<ConnectItemReply> {
  const { network } = parseAccountId(accountId);
  const { publicKey, address } = wallet;

  const stateInit = await ton.getWalletStateInit(accountId, wallet);

  return {
    name: 'ton_addr',
    address: toRawAddress(address),
    network: network === 'mainnet' ? CHAIN.MAINNET : CHAIN.TESTNET,
    publicKey,
    walletStateInit: stateInit
      .toBoc({ idx: true, crc32: true })
      .toString('base64'),
  };
}

async function signTonProof(
  accountId: string,
  account: ApiAccountWithMnemonic,
  password: string,
  walletAddress: string,
  proof: ApiTonConnectProof,
): Promise<TonProofItemReplySuccess> {
  const keyPair = await fetchKeyPair(accountId, password, account);
  const { timestamp, domain, payload } = proof;

  const timestampBuffer = Buffer.allocUnsafe(8);
  timestampBuffer.writeBigInt64LE(BigInt(timestamp));

  const domainBuffer = Buffer.from(domain);
  const domainLengthBuffer = Buffer.allocUnsafe(4);
  domainLengthBuffer.writeInt32LE(domainBuffer.byteLength);

  const address = Address.parse(walletAddress);

  const addressWorkchainBuffer = Buffer.allocUnsafe(4);
  addressWorkchainBuffer.writeInt32BE(address.workChain);

  const addressBuffer = Buffer.concat([
    addressWorkchainBuffer,
    address.hash,
  ]);

  const messageBuffer = Buffer.concat([
    Buffer.from('ton-proof-item-v2/', 'utf8'),
    addressBuffer,
    domainLengthBuffer,
    domainBuffer,
    timestampBuffer,
    Buffer.from(payload),
  ]);

  const bufferToSign = Buffer.concat([
    Buffer.from('ffff', 'hex'),
    Buffer.from('ton-connect', 'utf8'),
    Buffer.from(await sha256(messageBuffer)),
  ]);

  const signature = nacl.sign.detached(
    Buffer.from(await sha256(bufferToSign)),
    keyPair!.secretKey,
  );

  return buildTonProofReplyItem(proof, bytesToBase64(signature));
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

export async function fetchDappMetadata(manifestUrl: string, origin?: string): Promise<ApiDappMetadata> {
  try {
    const data = await fetchJsonMetadata(manifestUrl);

    const { url, name, iconUrl } = await data;
    const safeIconUrl = iconUrl.startsWith('data:') ? BLANK_GIF_DATA_URL : iconUrl;
    if (!isValidUrl(url) || !isValidString(name) || !isValidUrl(safeIconUrl)) {
      throw new Error('Invalid data');
    }

    return {
      origin: origin ?? new URL(url).origin,
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

async function validateRequest(request: ApiDappRequest, skipConnection = false) {
  const { origin } = request;
  if (!origin) {
    throw new errors.BadRequestError('Invalid origin');
  }

  let accountId = '';
  if (request.accountId) {
    accountId = request.accountId;
  } else if (!skipConnection) {
    const { network } = parseAccountId(await getCurrentAccountIdOrFail());
    const lastAccountId = await findLastConnectedAccount(network, origin);
    if (!lastAccountId) {
      throw new errors.BadRequestError('The connection is outdated, try relogin');
    }
    accountId = lastAccountId;
  }

  return { origin, accountId };
}

async function openExtensionPopup(force?: boolean) {
  if (!IS_EXTENSION || (!force && onPopupUpdate && isUpdaterAlive(onPopupUpdate))) {
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

// eslint-disable-next-line max-classes-per-file
import type { KeyPair } from 'tonweb-mnemonic';
import TonWeb from 'tonweb';
import type {
  ConnectEventError,
  ConnectItemReply,
  ConnectRequest,
  DisconnectEvent,
  SendTransactionRpcRequest,
  SendTransactionRpcResponse,
  TonProofItem,
  TonProofItemReplySuccess,
} from '@tonconnect/protocol';
import {
  CHAIN,
} from '@tonconnect/protocol';
import nacl from 'tweetnacl';

import { ApiTransactionDraftError, ApiTransactionError } from '../types';
import {
  CONNECT_EVENT_ERROR_CODES,
  SEND_TRANSACTION_ERROR_CODES,
} from './types';
import type { Storage } from '../storages/types';
import type {
  ApiDapp,
  ApiDappRequest,
  ApiNetwork,
  ApiSignedTransfer,
  OnApiUpdate,
} from '../types';
import type {
  LocalConnectEvent,
  TransactionPayload,
  TransactionPayloadMessage,
} from './types';

import { TON_TOKEN_SLUG } from '../../config';
import { buildAccountId, parseAccountId } from '../../util/account';
import { logDebugError } from '../../util/logs';
import blockchains from '../blockchains';
import { fetchKeyPair } from '../blockchains/ton/auth';
import { parsePayload } from '../blockchains/ton/transactions';
import { toBase64Address, toRawAddress } from '../blockchains/ton/util/tonweb';
import { fetchStoredAccount, fetchStoredAddress, fetchStoredPublicKey } from '../common/accounts';
import { createDappPromise } from '../common/dappPromises';
import { createLocalTransaction, toInternalAccountId } from '../common/helpers';
import {
  base64ToBytes, bytesToBase64, handleFetchErrors, sha256,
} from '../common/utils';
import { getActiveDappAccountId } from '../dappMethods';
import { openPopupWindow } from '../dappMethods/window';
import * as apiErrors from '../errors';
import {
  activateDapp,
  addDapp,
  addDappToAccounts,
  deactivateAccountDapp,
  deactivateDapp,
  deleteDapp,
  findActiveDappAccount,
  findConnectedDappAccounts,
  getDappsByOrigin,
  isDappConnected,
} from '../methods/dapps';
import * as errors from './errors';

const { Address } = TonWeb.utils;

const ton = blockchains.ton;

let onPopupUpdate: OnApiUpdate;
let storage: Storage;

export function initTonConnect(_onPopupUpdate: OnApiUpdate, _storage: Storage) {
  onPopupUpdate = _onPopupUpdate;
  storage = _storage;
}

export async function connect(
  request: ApiDappRequest,
  message: ConnectRequest,
  id: number,
): Promise<LocalConnectEvent> {
  try {
    const { currentAccountId: accountId, origin } = validateRequest(request, true);
    const dapp = await fetchDapp(origin, message.manifestUrl);

    const addressItem = message.items.find(({ name }) => name === 'ton_addr');
    const proofItem = message.items.find(({ name }) => name === 'ton_proof') as TonProofItem | undefined;

    if (!addressItem) {
      throw new errors.BadRequestError("Missing 'ton_addr'");
    }

    // TODO Initialize the API in a different way
    if (!onPopupUpdate) {
      await openPopupWindow();
    }

    const isConnected = await isDappConnected(accountId, origin);
    let password: string | undefined;

    if (!isConnected || !!proofItem) {
      await openPopupWindow();

      const { promiseId, promise } = createDappPromise();

      onPopupUpdate({
        type: 'dappConnect',
        promiseId,
        accountId,
        dapp,
        permissions: {
          address: true,
          proof: !!proofItem,
        },
      });

      const result: {
        additionalAccountIds: string[];
        password: string;
      } = await promise;

      const { additionalAccountIds } = result;
      password = result.password;

      if (additionalAccountIds) {
        await addDappToAccounts(dapp, [accountId].concat(additionalAccountIds));
      } else {
        await addDapp(accountId, dapp);
      }
    }

    const result = await reconnect(request, id);

    if (result.event === 'connect' && proofItem) {
      const address = await fetchStoredAddress(storage, accountId);
      result.payload.items.push(await buildTonProofReplyItem(
        accountId,
        address,
        password!,
        origin,
        proofItem.payload,
      ));
    }

    return result;
  } catch (err) {
    logDebugError('tonConnect:connect', err);
    return formatConnectError(id, err as Error);
  }
}

export async function reconnect(request: ApiDappRequest, id: number): Promise<LocalConnectEvent> {
  try {
    const { origin, currentAccountId, activeAccountId } = validateRequest(request, true);
    const { network } = parseAccountId(currentAccountId);

    // TODO Initialize the API in a different way
    if (!onPopupUpdate) {
      await openPopupWindow();
    }

    const connectedInternalAccountIds = await findConnectedDappAccounts(origin);
    const isConnected = !!connectedInternalAccountIds.length;

    if (!isConnected) {
      throw new errors.UnknownAppError();
    }

    let accountId: string;

    if (activeAccountId) {
      accountId = activeAccountId;
    } else if (connectedInternalAccountIds.includes(toInternalAccountId(currentAccountId))) {
      accountId = currentAccountId;
    } else {
      accountId = buildAccountId({
        ...parseAccountId(connectedInternalAccountIds[0]),
        network,
      });
    }

    activateDapp(accountId, origin);

    const address = await fetchStoredAddress(storage, accountId);
    const items: ConnectItemReply[] = [
      await buildTonAddressReplyItem(accountId, address),
    ];

    return {
      event: 'connect',
      id,
      payload: { items },
    };
  } catch (e) {
    return formatConnectError(id, e as Error);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function disconnect(request: ApiDappRequest, message: DisconnectEvent): Promise<DisconnectEvent> {
  try {
    const { origin, activeAccountId } = validateRequest(request);
    const accountId = activeAccountId!;

    deactivateAccountDapp(accountId);
    await deleteDapp(accountId, origin, true);
  } catch (err) {
    logDebugError('tonConnect:disconnect', err);
  }
  return {
    event: 'disconnect',
    id: message.id,
    payload: {},
  };
}

export async function sendTransaction(
  request: ApiDappRequest,
  message: SendTransactionRpcRequest,
): Promise<SendTransactionRpcResponse> {
  let isPopupOpen = false;

  try {
    const { origin, activeAccountId } = validateRequest(request);
    const accountId = activeAccountId!;

    const txPayload = JSON.parse(message.params[0]) as TransactionPayload;
    const messages = txPayload.messages.slice(0, 3);
    let validUntil = txPayload.valid_until;
    if (validUntil && validUntil > 10 ** 10) {
      // If milliseconds were passed instead of seconds
      validUntil = Math.round(validUntil / 1000);
    }

    const { network } = parseAccountId(accountId);
    const account = await fetchStoredAccount(storage, accountId);
    const isLedger = !!account?.ledger;

    await openPopupWindow();
    isPopupOpen = true;

    const { preparedMessages, checkResult } = await checkTransactionMessages(accountId, messages);

    const { promiseId, promise } = createDappPromise();

    // TODO Cache dapps in localstorage when connecting
    const dapp = (await getDappsByOrigin(accountId))[origin];
    const transactionsForRequest = await prepareTransactionForRequest(network, messages);

    onPopupUpdate({
      type: 'dappSendTransactions',
      promiseId,
      accountId,
      dapp,
      transactions: transactionsForRequest,
      fee: checkResult.fee!,
    });

    // eslint-disable-next-line prefer-const
    const response: string | ApiSignedTransfer[] = await promise;

    if (validUntil && validUntil < (Date.now() / 1000)) {
      throw new errors.BadRequestError('The confirmation timeout has expired');
    }

    let submitResult: any | { error: string };
    let successNumber: number;

    if (isLedger) {
      submitResult = await ton.sendSignedMessages(storage, accountId, response as ApiSignedTransfer[]);
      successNumber = submitResult.successNumber;
      if (successNumber > 0) {
        if (successNumber < messages.length) {
          onPopupUpdate({
            type: 'showError',
            error: ApiTransactionError.PartialTransactionFailure,
          });
        }
      } else {
        submitResult = { error: 'Failed transfers' };
      }
    } else {
      const password = response as string;
      successNumber = messages.length;
      submitResult = await ton.submitMultiTransfer(
        storage,
        accountId,
        password!,
        preparedMessages,
        validUntil,
      );
    }

    if ('error' in submitResult) {
      throw new errors.UnknownError(submitResult.error);
    }

    const fromAddress = await fetchStoredAddress(storage, accountId);
    const successTransactions = transactionsForRequest.slice(0, successNumber);

    successTransactions.forEach(({ amount, resolvedAddress, payload }) => {
      const comment = payload?.type === 'comment' ? payload.comment : undefined;
      createLocalTransaction(onPopupUpdate, accountId, {
        amount,
        fromAddress,
        toAddress: resolvedAddress,
        comment,
        fee: checkResult.fee!,
        slug: TON_TOKEN_SLUG,
      });
    });

    return {
      result: 'ok',
      id: message.id,
    };
  } catch (err) {
    logDebugError('tonConnect:sendTransaction', err);

    let code = SEND_TRANSACTION_ERROR_CODES.UNKNOWN_ERROR;
    let errorMessage = 'Unhandled error';

    if (err instanceof apiErrors.ApiUserRejectsError) {
      code = SEND_TRANSACTION_ERROR_CODES.USER_REJECTS_ERROR;
      errorMessage = err.message;
    } else if (err instanceof errors.TonConnectError) {
      code = err.code;
      errorMessage = err.message;
    } else if (isPopupOpen) {
      onPopupUpdate({
        type: 'showTxDraftError',
        error: ApiTransactionDraftError.Unexpected,
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

async function checkTransactionMessages(accountId: string, messages: TransactionPayloadMessage[]) {
  const preparedMessages = messages.map((msg) => {
    const {
      address,
      amount,
      payload,
      stateInit,
    } = msg;

    return {
      toAddress: address,
      amount,
      payload: payload ? ton.oneCellFromBoc(base64ToBytes(payload)) : undefined,
      stateInit: stateInit ? ton.oneCellFromBoc(base64ToBytes(stateInit)) : undefined,
    };
  });

  const checkResult = await ton.checkMultiTransactionDraft(storage, accountId, preparedMessages);
  handleDraftError(checkResult);

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
      const isInitialized = await ton.isWalletInitialized(network, address);
      const resolvedAddress = toBase64Address(address);

      // Force non-bounceable for non-initialized recipients
      const toAddress = isInitialized ? resolvedAddress : toBase64Address(address, false);
      const payload = rawPayload ? await parsePayload(network, toAddress, rawPayload) : undefined;

      return {
        resolvedAddress,
        toAddress,
        amount,
        rawPayload,
        payload,
        stateInit,
      };
    },
  ));
}

export function deactivate(request: ApiDappRequest) {
  try {
    const { origin } = validateRequest(request);

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

async function buildTonAddressReplyItem(accountId: string, address: string): Promise<ConnectItemReply> {
  const { network } = parseAccountId(accountId);
  const [stateInit, publicKey] = await Promise.all([
    ton.getWalletStateInit(storage, accountId),
    fetchStoredPublicKey(storage, accountId),
  ]);
  return {
    name: 'ton_addr',
    address: toRawAddress(address),
    network: network === 'mainnet' ? CHAIN.MAINNET : CHAIN.TESTNET,
    publicKey,
    walletStateInit: stateInit,
  };
}

async function buildTonProofReplyItem(
  accountId: string,
  address: string,
  password: string,
  origin: string,
  payload: string,
) {
  const keyPair = await fetchKeyPair(storage, accountId, password);

  return buildTonProofSignature(
    address,
    keyPair!,
    new URL(origin).host,
    payload,
  );
}

async function buildTonProofSignature(
  walletAddress: string,
  keyPair: KeyPair,
  domain: string,
  payload: string,
): Promise<TonProofItemReplySuccess> {
  const timestamp = Math.round(Date.now() / 1000);
  const timestampBuffer = Buffer.allocUnsafe(8);
  timestampBuffer.writeBigInt64LE(BigInt(timestamp));

  const domainBuffer = Buffer.from(domain);
  const domainLengthBuffer = Buffer.allocUnsafe(4);
  domainLengthBuffer.writeInt32LE(domainBuffer.byteLength);

  const address = new Address(walletAddress);

  const addressWorkchainBuffer = Buffer.allocUnsafe(4);
  addressWorkchainBuffer.writeInt32BE(address.wc);

  const addressBuffer = Buffer.concat([
    addressWorkchainBuffer,
    Buffer.from(address.hashPart),
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
    keyPair.secretKey,
  );

  return {
    name: 'ton_proof',
    proof: {
      timestamp,
      domain: {
        lengthBytes: domainBuffer.byteLength,
        value: domainBuffer.toString('utf8'),
      },
      signature: bytesToBase64(signature),
      payload,
    },
  };
}

async function fetchDapp(origin: string, manifestUrl: string): Promise<ApiDapp> {
  try {
    const response = await fetch(manifestUrl);
    handleFetchErrors(response);

    const { url, name, iconUrl } = await response.json();
    if (!isValidUrl(url) || !isValidString(name) || !isValidUrl(iconUrl)) {
      throw new Error('Invalid data');
    }

    return {
      origin,
      url,
      name,
      iconUrl,
      manifestUrl,
    };
  } catch (err) {
    logDebugError('fetchDapp', err);
    throw new errors.ManifestContentError();
  }
}

function isValidString(value: any, maxLength = 100) {
  return typeof value === 'string' && value.length <= maxLength;
}

function isValidUrl(url: string) {
  const isString = isValidString(url, 150);
  if (!isString) return false;

  try {
    // eslint-disable-next-line no-new
    new URL(url);
    return true;
  } catch (err) {
    return false;
  }
}

function validateRequest(request: ApiDappRequest, skipConnection = false) {
  const { origin } = request;
  if (!origin) {
    throw new errors.BadRequestError('Invalid origin');
  }

  const currentAccountId = getActiveDappAccountId();

  if (!currentAccountId) {
    throw new errors.BadRequestError('The user is not authorized in the wallet');
  }

  const activeAccountId = findActiveDappAccount(origin);
  if (!skipConnection && !activeAccountId) {
    throw new errors.BadRequestError('The connection is outdated, try relogin');
  }

  return {
    origin,
    activeAccountId,
    currentAccountId,
  };
}

function handleDraftError({ error }: { error?: ApiTransactionDraftError }) {
  if (error) {
    onPopupUpdate({
      type: 'showTxDraftError',
      error,
    });
    throw new errors.BadRequestError(error);
  }
}

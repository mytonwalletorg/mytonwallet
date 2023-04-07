// eslint-disable-next-line max-classes-per-file
import {
  CHAIN,
  ConnectEventError,
  ConnectItemReply,
  ConnectRequest,
  DisconnectEvent,
  SendTransactionRpcRequest,
  SendTransactionRpcResponse,
  TonProofItem,
  TonProofItemReplySuccess,
} from '@tonconnect/protocol';

import { KeyPair } from 'tonweb-mnemonic';
import TonWeb from 'tonweb';
import nacl from 'tweetnacl';
import {
  base64ToBytes, bytesToBase64, handleFetchErrors, sha256,
} from '../common/utils';
import storage from '../storages/idb';
import { getActiveDappAccountId } from '../dappMethods';
import {
  activateDapp,
  addDapp,
  addDappToAccounts,
  deactivateAccountDapp,
  deactivateDapp,
  deleteDapp,
  findConnectedAccountByDapp,
  getDappsByOrigin,
  isDappActive,
  isDappConnected,
} from '../methods/dapps';
import { parseAccountId } from '../../util/account';
import blockchains from '../blockchains';
import { DEBUG, TON_TOKEN_SLUG } from '../../config';
import {
  ApiDapp, ApiDappRequest, ApiTransactionDraftError, OnApiUpdate,
} from '../types';
import { fetchKeyPair } from '../blockchains/ton/auth';
import { toBase64Address, toRawAddress } from '../blockchains/ton/util/tonweb';
import { openPopupWindow } from '../dappMethods/window';
import { createDappPromise } from '../common/dappPromises';
import { buildLocalTransaction } from '../common/helpers';
import { whenTxComplete } from '../common/txCallbacks';
import * as errors from './errors';
import {
  CONNECT_EVENT_ERROR_CODES,
  LocalConnectEvent,
  SEND_TRANSACTION_ERROR_CODES,
  TransactionPayload,
} from './types';
import { ApiUserRejectsError } from '../errors';

const { Address } = TonWeb.utils;

const ton = blockchains.ton;

let onPopupUpdate: OnApiUpdate;

export function initTonConnect(_onPopupUpdate: OnApiUpdate) {
  onPopupUpdate = _onPopupUpdate;
}

export async function connect(
  request: ApiDappRequest,
  message: ConnectRequest,
  id: number,
): Promise<LocalConnectEvent> {
  try {
    const { accountId, origin } = validateRequest(request, true);
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
      const address = await ton.fetchAddress(storage, accountId);
      result.payload.items.push(await buildTonProofReplyItem(
        accountId,
        address,
        password!,
        origin,
        proofItem.payload,
      ));
    }

    return result;
  } catch (e) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error('[connect]', e);
    }
    return formatConnectError(id, e as Error);
  }
}

export async function reconnect(request: ApiDappRequest, id: number): Promise<LocalConnectEvent> {
  try {
    const { origin, accountId } = validateRequest(request, true);

    // TODO Initialize the API in a different way
    if (!onPopupUpdate) {
      await openPopupWindow();
    }

    const isConnected = await isDappConnected(accountId, origin);

    if (!isConnected) {
      throw new errors.UnknownAppError();
    }

    activateDapp(accountId, origin);

    const address = await ton.fetchAddress(storage, accountId);
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
    const { origin } = validateRequest(request, true);

    const connectedAccountId = findConnectedAccountByDapp(origin);
    if (connectedAccountId) {
      deactivateAccountDapp(connectedAccountId);
      await deleteDapp(connectedAccountId, origin);
    }
  } catch (e) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error('[disconnect]', e);
    }
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
    const { accountId, origin } = validateRequest(request);

    const txPayload = JSON.parse(message.params[0]) as TransactionPayload;
    const messages = txPayload.messages.slice(0, 3);
    let validUntil = txPayload.valid_until;
    if (validUntil && validUntil > 10 ** 10) {
      // If milliseconds were passed instead of seconds
      validUntil = Math.round(validUntil / 1000);
    }

    await openPopupWindow();
    isPopupOpen = true;

    const preparedMessages = messages.map((msg) => {
      const {
        address, amount, payload, stateInit,
      } = msg;

      return {
        toAddress: address,
        amount,
        payload: payload ? ton.oneCellFromBoc(base64ToBytes(payload)) : undefined,
        stateInit: stateInit ? ton.oneCellFromBoc(base64ToBytes(stateInit)) : undefined,
      };
    });

    const { fee, error } = await ton.checkMultiTransactionDraft(storage, accountId, preparedMessages);

    if (error) {
      onPopupUpdate({
        type: 'showTxDraftError',
        error,
      });
      throw new errors.BadRequestError(error);
    }

    const { promiseId, promise } = createDappPromise();

    // TODO Cache dapps in localstorage when connecting
    const dapp = (await getDappsByOrigin(accountId))[origin];

    onPopupUpdate({
      type: 'dappSendTransactions',
      promiseId,
      accountId,
      dapp,
      transactions: messages.map(({ address, amount, payload }) => ({
        toAddress: toBase64Address(address),
        amount,
        payload,
      })),
      fee: fee!,
    });

    const password = await promise;

    if (validUntil && validUntil < (Date.now() / 1000)) {
      throw new errors.BadRequestError('The confirmation timeout has expired');
    }

    const submitResult = await ton.submitMultiTransfer(
      storage,
      accountId,
      password,
      preparedMessages,
      validUntil,
    );

    if (!submitResult) {
      throw new errors.UnknownError('Unknown error during transfer');
    }

    const resultMessages = submitResult.messages;
    const fromAddress = await ton.fetchAddress(storage, accountId);

    resultMessages.forEach((resultMessage) => {
      const { resolvedAddress, amount } = resultMessage;

      const localTransaction = buildLocalTransaction({
        amount,
        fromAddress,
        toAddress: resolvedAddress,
        fee: fee!,
        slug: TON_TOKEN_SLUG,
      });

      onPopupUpdate({
        type: 'newLocalTransaction',
        transaction: localTransaction,
        accountId,
      });

      whenTxComplete(resolvedAddress, amount)
        .then(({ txId }) => {
          onPopupUpdate({
            type: 'updateTxComplete',
            accountId,
            toAddress: resolvedAddress,
            amount,
            txId,
            localTxId: localTransaction.txId,
          });
        });
    });

    return {
      result: 'ok',
      id: message.id,
    };
  } catch (e) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error('[sendTransaction]', e);
    }

    let code = SEND_TRANSACTION_ERROR_CODES.UNKNOWN_ERROR;
    let errorMessage = 'Unhandled error';

    if (e instanceof ApiUserRejectsError) {
      code = SEND_TRANSACTION_ERROR_CODES.USER_REJECTS_ERROR;
      errorMessage = e.message;
    } else if (e instanceof errors.TonConnectError) {
      code = e.code;
      errorMessage = e.message;
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

export function deactivate(request: ApiDappRequest) {
  try {
    const { origin } = validateRequest(request);

    deactivateDapp(origin);
  } catch (e) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error('[deactivate]', e);
    }
  }
}

function formatConnectError(id: number, error: Error): ConnectEventError {
  let code = CONNECT_EVENT_ERROR_CODES.UNKNOWN_ERROR;
  let message = 'Unhandled error';

  if (error instanceof ApiUserRejectsError) {
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
    ton.fetchPublicKey(storage, accountId),
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
  } catch (e) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error('[fetchDapp]', e);
    }
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

  const accountId = getActiveDappAccountId();
  if (!accountId) {
    throw new errors.BadRequestError('The user is not authorized in the wallet');
  }
  if (!skipConnection && !isDappActive(accountId, origin)) {
    throw new errors.BadRequestError('Connection to the current account is not established');
  }
  return {
    origin,
    accountId,
  };
}

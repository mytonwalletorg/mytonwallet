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
  base64ToBytes,
  bytesToBase64,
  handleFetchErrors,
  sha256,
} from '../common/utils';
import storage from '../storages/idb';
import { getActiveDappAccountId } from '../dappMethods';
import {
  addDapp,
  addDappToAccounts,
  isDappConnected,
  isDappActive,
  activateDapp,
  deleteDapp,
} from '../methods/dapps';
import { parseAccountId } from '../../util/account';
import blockchains from '../blockchains';
import { DEBUG, TON_TOKEN_SLUG } from '../../config';
import {
  ApiDapp, ApiDappRequest, OnApiUpdate, ApiTransaction,
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
  SEND_TRANSACTION_ERROR_CODES,
  LocalConnectEvent,
  TransactionPayload,
} from './types';

const { Address } = TonWeb.utils;

const ton = blockchains.ton;

let onPopupUpdate: OnApiUpdate;

export function initTonConnect(_onPopupUpdate: OnApiUpdate) {
  onPopupUpdate = _onPopupUpdate;
}

export async function connect(request: ApiDappRequest, message: ConnectRequest): Promise<LocalConnectEvent> {
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
        isUserAllowed: boolean;
        additionalAccountIds?: string[];
        password?: string;
      } = await promise;

      const { isUserAllowed, additionalAccountIds } = result;
      if (!isUserAllowed) {
        throw new errors.UserRejectsError();
      }

      password = result.password;
      if (additionalAccountIds) {
        await addDappToAccounts(dapp, [accountId].concat(additionalAccountIds));
      } else {
        await addDapp(accountId, dapp);
      }
    }

    const result = await reconnect(request);

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
    return formatConnectError(e as Error);
  }
}

export async function reconnect(request: ApiDappRequest): Promise<LocalConnectEvent> {
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
      payload: { items },
    };
  } catch (e) {
    return formatConnectError(e as Error);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function disconnect(request: ApiDappRequest, message: DisconnectEvent): Promise<DisconnectEvent> {
  try {
    const { origin, accountId } = validateRequest(request, true);
    await deleteDapp(accountId, origin);
  } catch (e) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error('[disconnect]', e);
    }
  }
  return {
    event: 'disconnect',
    payload: {},
  };
}

export async function sendTransaction(
  request: ApiDappRequest,
  message: SendTransactionRpcRequest,
): Promise<SendTransactionRpcResponse> {
  try {
    const { accountId } = validateRequest(request);

    const txPayload = JSON.parse(message.params[0]) as TransactionPayload;
    const messages = txPayload.messages.slice(0, 3);

    // TODO Remove after multitransaction support
    if (messages.length > 1) {
      throw new errors.BadRequestError('Multiple transactions are temporarily not supported');
    }

    await openPopupWindow();

    const checkResults = await Promise.all(messages.map(async (msg) => {
      const {
        address: toAddress,
        amount,
        payload,
        stateInit,
      } = msg;
      const processedData = payload ? ton.oneCellFromBoc(base64ToBytes(payload)) : undefined;
      const processedStateInit = stateInit ? ton.oneCellFromBoc(base64ToBytes(stateInit)) : undefined;

      const result = await ton.checkTransactionDraft(
        storage, accountId, TON_TOKEN_SLUG, toAddress, amount, processedData, processedStateInit,
      );
      return {
        toAddress: toBase64Address(toAddress),
        amount,
        processedData,
        processedStateInit,
        result,
      };
    }));

    const breakResult = checkResults.find(({ result }) => (!result || result.error));

    if (breakResult) {
      onPopupUpdate({
        type: 'showTxDraftError',
        error: breakResult?.result.error,
      });
      if (breakResult?.result.error) {
        throw new errors.BadRequestError(breakResult.result.error);
      }
      throw new errors.UnknownError();
    }

    const balance = await ton.getAccountBalance(storage, accountId);
    const totalAmount = checkResults.reduce((amount, result) => {
      return amount + BigInt(result.amount) + BigInt(result.result.fee!);
    }, 0n);
    if (BigInt(totalAmount) > BigInt(balance!)) {
      throw new errors.InsufficientBalance();
    }

    const { promiseId, promise } = createDappPromise();

    // TODO Update after multitransaction support
    const checkResult = checkResults[0];
    onPopupUpdate({
      type: 'createTransaction',
      promiseId,
      toAddress: checkResult.toAddress,
      amount: checkResult.amount,
      fee: checkResult.result.fee!,
    });

    // onPopupUpdate({
    //   type: 'createTransactions',
    //   promiseId,
    //   transactions: checkResults.map(({ toAddress, amount, result }) => ({
    //     toAddress,
    //     amount,
    //     fee: result.fee!,
    //   })),
    // });

    const password = await promise;
    const fromAddress = await ton.fetchAddress(storage, accountId);
    const submitResults: Array<{
      resolvedAddress: string;
      amount: string;
      localTransaction: ApiTransaction;
    } | undefined> = [];

    for (const {
      toAddress, amount, processedData, processedStateInit, result,
    } of checkResults) {
      const submitResult = await ton.submitTransfer(
        storage, accountId, password, TON_TOKEN_SLUG, toAddress, amount, processedData, processedStateInit,
      );

      if (submitResult) {
        const localTransaction = buildLocalTransaction({
          amount,
          fromAddress,
          toAddress,
          fee: result.fee!,
          slug: TON_TOKEN_SLUG,
        });
        submitResults.push({
          ...submitResult,
          localTransaction,
        });

        onPopupUpdate({
          type: 'newTransaction',
          transaction: localTransaction,
          accountId,
        });
      } else {
        // TODO Reset transfer modal state
        // TODO Это ещё актуально ^ ?
        submitResults.push(submitResult);
      }
    }

    // TODO Update after multitransaction support
    if (submitResults[0]) {
      const { toAddress } = checkResult;
      const { resolvedAddress, amount, localTransaction } = submitResults[0];
      whenTxComplete(resolvedAddress, amount)
        .then(({ txId }) => {
          onPopupUpdate({
            type: 'updateTxComplete',
            toAddress,
            amount,
            txId,
            localTxId: localTransaction.txId,
          });
        });
    }

    return {
      result: 'ok',
      id: message.id,
    };
  } catch (e) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error('[sendTransaction]', e);
    }
    return {
      error: e instanceof errors.TonConnectError ? {
        code: e.code,
        message: e.message,
      } : {
        code: SEND_TRANSACTION_ERROR_CODES.UNKNOWN_ERROR,
        message: 'Unhandled error',
      },
      id: message.id,
    };
  }
}

function formatConnectError(error: Error): ConnectEventError {
  return {
    event: 'connect_error',
    payload: error instanceof errors.TonConnectError ? {
      code: error.code,
      message: error.message,
    } : {
      code: CONNECT_EVENT_ERROR_CODES.UNKNOWN_ERROR,
      message: 'Unhandled error',
    },
  };
}

async function buildTonAddressReplyItem(accountId: string, address: string): Promise<ConnectItemReply> {
  const { network } = parseAccountId(accountId);
  const stateInit = await ton.getWalletStateInit(storage, accountId);
  return {
    name: 'ton_addr',
    address: toRawAddress(address),
    network: network === 'mainnet' ? CHAIN.MAINNET : CHAIN.TESTNET,
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
  const accountId = getActiveDappAccountId();
  const { origin } = request;
  if (!origin) {
    throw new errors.BadRequestError();
  }
  if (!accountId) {
    throw new errors.BadRequestError();
  }
  if (!skipConnection && !isDappActive(accountId, origin)) {
    throw new errors.BadRequestError();
  }
  return {
    origin,
    accountId,
  };
}

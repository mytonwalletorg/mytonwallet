import type { OnApiUpdate } from '../types';
import type { ApiDappUpdate, OnApiDappUpdate } from '../types/dappUpdates';

import blockchains from '../blockchains';
import storage from '../storages/idb';
import { buildLocalTransaction, resolveBlockchainKey } from '../methods/helpers';
import { MAIN_ACCOUNT_ID, TON_TOKEN_SLUG } from '../../config';
import { createDappPromise, resolveDappPromise } from '../common/dappPromises';
import { clearCache, openPopupWindow } from './window';
import { whenTxComplete } from '../common/txCallbacks';
import { base64ToBytes, hexToBytes } from '../common/utils';

let onPopupUpdate: OnApiUpdate;

// Sometimes (e.g. when Dev Tools is open) dapp needs more time to subscribe to provider
const INIT_UPDATE_DELAY = 50;

const dappUpdaters: OnApiDappUpdate[] = [];
const ton = blockchains[resolveBlockchainKey(MAIN_ACCOUNT_ID)!];

export function initDappMethods(_onPopupUpdate: OnApiUpdate) {
  onPopupUpdate = _onPopupUpdate;
  resolveDappPromise('whenPopupReady');
}

export async function connectDapp(onDappUpdate: OnApiDappUpdate) {
  dappUpdaters.push(onDappUpdate);

  const accounts = await requestAccounts();
  const isTonMagicEnabled = await storage.getItem('isTonMagicEnabled');

  function sendUpdates() {
    onDappUpdate({
      type: 'updateAccounts',
      accounts,
    });

    onDappUpdate({
      type: 'updateTonMagic',
      isEnabled: Boolean(isTonMagicEnabled),
    });
  }

  sendUpdates();
  setTimeout(sendUpdates, INIT_UPDATE_DELAY);
}

export function disconnectDapp(onDappUpdate: OnApiDappUpdate) {
  const index = dappUpdaters.findIndex((updater) => updater === onDappUpdate);
  if (index !== 1) {
    dappUpdaters.splice(index, 1);
  }
}

export function updateDapps(update: ApiDappUpdate) {
  dappUpdaters.forEach((onDappUpdate) => {
    onDappUpdate(update);
  });
}

export function getBalance() {
  return ton.getAccountBalance(storage, MAIN_ACCOUNT_ID);
}

export async function requestAccounts() {
  const address = await ton.fetchAddress(storage, MAIN_ACCOUNT_ID);
  return [address];
}

export async function requestWallets() {
  const [address, publicKey, wallet] = await Promise.all([
    ton.fetchAddress(storage, MAIN_ACCOUNT_ID),
    ton.fetchPublicKey(storage, MAIN_ACCOUNT_ID),
    ton.pickAccountWallet(storage, MAIN_ACCOUNT_ID),
  ]);

  return [{
    address,
    publicKey,
    walletVersion: wallet ? ton.resolveWalletVersion(wallet) : undefined,
  }];
}

export async function sendTransaction(params: {
  to: string;
  value: string;
  data?: string;
  dataType?: 'text' | 'hex' | 'base64' | 'boc';
  stateInit?: string;
}) {
  const {
    value: amount, to: toAddress, data, dataType, stateInit,
  } = params;

  let processedData;
  if (data) {
    switch (dataType) {
      case 'hex':
        processedData = hexToBytes(data);
        break;
      case 'base64':
        processedData = base64ToBytes(data);
        break;
      case 'boc':
        processedData = ton.oneCellFromBoc(base64ToBytes(data));
        break;
      default:
        processedData = data;
    }
  }

  const processedStateInit = stateInit ? ton.oneCellFromBoc(base64ToBytes(stateInit)) : undefined;

  await openPopupWindow();

  const checkResult = await ton.checkTransactionDraft(
    storage, MAIN_ACCOUNT_ID, TON_TOKEN_SLUG, toAddress, amount, processedData, processedStateInit,
  );

  if (!checkResult || checkResult?.error) {
    onPopupUpdate({
      type: 'showTxDraftError',
      error: checkResult?.error,
    });

    return false;
  }

  const { promiseId, promise } = createDappPromise();

  onPopupUpdate({
    type: 'createTransaction',
    promiseId,
    toAddress,
    amount,
    fee: checkResult.fee!,
    ...(dataType === 'text' && {
      comment: data,
    }),
  });

  const password = await promise;

  const result = await ton.submitTransfer(
    storage, MAIN_ACCOUNT_ID, password, TON_TOKEN_SLUG, toAddress, amount, processedData, processedStateInit,
  );

  if (result) {
    const fromAddress = await ton.fetchAddress(storage, MAIN_ACCOUNT_ID);
    const localTransaction = buildLocalTransaction({
      amount,
      fromAddress,
      toAddress,
      fee: checkResult.fee!,
      slug: TON_TOKEN_SLUG,
      ...(dataType === 'text' && {
        comment: data,
      }),
    });

    onPopupUpdate({
      type: 'newTransaction',
      transaction: localTransaction,
    });

    whenTxComplete(result.resolvedAddress, amount)
      .then(({ txId }) => {
        onPopupUpdate({
          type: 'updateTxComplete',
          toAddress,
          amount,
          txId,
          localTxId: localTransaction.txId,
        });
      });
  } else {
    // TODO Reset transfer modal state
  }

  return Boolean(result);
}

export async function rawSign({ data }: { data: string }) {
  await openPopupWindow();

  const { promiseId, promise } = createDappPromise();

  onPopupUpdate({
    type: 'createSignature',
    promiseId,
    dataHex: data,
  });

  const password = await promise;

  return ton.rawSign(storage, MAIN_ACCOUNT_ID, password, data);
}

export async function flushMemoryCache() {
  await clearCache();
}

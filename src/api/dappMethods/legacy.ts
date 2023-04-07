import storage from '../storages/idb';
import { base64ToBytes, hexToBytes } from '../common/utils';
import { openPopupWindow } from './window';
import { TON_TOKEN_SLUG } from '../../config';
import { createDappPromise } from '../common/dappPromises';
import { buildLocalTransaction } from '../common/helpers';
import { whenTxComplete } from '../common/txCallbacks';
import { getActiveDappAccountId } from './index';
import blockchains from '../blockchains';
import { OnApiUpdate } from '../types';
import { OnApiDappUpdate } from '../types/dappUpdates';

const ton = blockchains.ton;
let onPopupUpdate: OnApiUpdate;

export function initLegacyDappMethods(_onPopupUpdate: OnApiUpdate) {
  onPopupUpdate = _onPopupUpdate;
}

export async function onDappSendUpdates(onDappUpdate: OnApiDappUpdate) {
  const accounts = await requestAccounts();

  onDappUpdate({
    type: 'updateAccounts',
    accounts,
  });
}

export function getBalance() {
  const activeAccountId = getActiveDappAccountId();
  if (!activeAccountId) {
    throw new Error('The user is not authorized in the wallet');
  }

  return ton.getAccountBalance(storage, activeAccountId);
}

export async function requestAccounts() {
  const activeAccountId = getActiveDappAccountId();
  if (!activeAccountId) {
    return [];
  }

  const address = await ton.fetchAddress(storage, activeAccountId);
  return [address];
}

export async function requestWallets() {
  const activeAccountId = getActiveDappAccountId();
  if (!activeAccountId) {
    return [];
  }

  const accountId = activeAccountId;
  const [address, publicKey, wallet] = await Promise.all([
    ton.fetchAddress(storage, accountId),
    ton.fetchPublicKey(storage, accountId),
    ton.pickAccountWallet(storage, accountId),
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
  const activeAccountId = getActiveDappAccountId();
  if (!activeAccountId) {
    throw new Error('The user is not authorized in the wallet');
  }

  const accountId = activeAccountId;
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
    storage, accountId, TON_TOKEN_SLUG, toAddress, amount, processedData, processedStateInit,
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
    storage, accountId, password, TON_TOKEN_SLUG, toAddress, amount, processedData, processedStateInit,
  );

  if (result) {
    const fromAddress = await ton.fetchAddress(storage, accountId);
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
      type: 'newLocalTransaction',
      transaction: localTransaction,
      accountId,
    });

    whenTxComplete(result.resolvedAddress, amount)
      .then(({ txId }) => {
        onPopupUpdate({
          type: 'updateTxComplete',
          accountId,
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
  const activeAccountId = getActiveDappAccountId();
  if (!activeAccountId) {
    throw new Error('The user is not authorized in the wallet');
  }

  const accountId = activeAccountId;

  await openPopupWindow();

  const { promiseId, promise } = createDappPromise();

  onPopupUpdate({
    type: 'createSignature',
    promiseId,
    dataHex: data,
  });

  const password = await promise;

  return ton.rawSign(storage, accountId, password, data);
}

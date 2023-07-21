import type { ApiDappUpdate, OnApiDappUpdate } from '../types/dappUpdates';
import type { OnApiUpdate } from '../types';

import { getCurrentAccountId, waitLogin } from '../common/accounts';
import { resolveDappPromise } from '../common/dappPromises';
import storage from '../storages/extension';
import { clearCache, openPopupWindow } from './window';

let onPopupUpdate: OnApiUpdate;

// Sometimes (e.g. when Dev Tools is open) dapp needs more time to subscribe to provider
const INIT_UPDATE_DELAY = 50;

const dappUpdaters: OnApiDappUpdate[] = [];

// This method is called from `initApi` which in turn is called when popup is open
export function initDappMethods(_onPopupUpdate: OnApiUpdate) {
  onPopupUpdate = _onPopupUpdate;
  resolveDappPromise('whenPopupReady');
}

export async function connectDapp(
  onDappUpdate: OnApiDappUpdate,
  onDappSendUpdates: (x: OnApiDappUpdate) => Promise<void>, // TODO Remove this when deleting the legacy provider
) {
  dappUpdaters.push(onDappUpdate);
  const isTonMagicEnabled = await storage.getItem('isTonMagicEnabled');
  const isDeeplinkHookEnabled = await storage.getItem('isDeeplinkHookEnabled');

  function sendUpdates() {
    onDappUpdate({
      type: 'updateTonMagic',
      isEnabled: Boolean(isTonMagicEnabled),
    });

    onDappUpdate({
      type: 'updateDeeplinkHook',
      isEnabled: Boolean(isDeeplinkHookEnabled),
    });

    onDappSendUpdates(onDappUpdate);
  }

  sendUpdates();
  setTimeout(sendUpdates, INIT_UPDATE_DELAY);
}

export function deactivateDapp(onDappUpdate: OnApiDappUpdate) {
  const index = dappUpdaters.findIndex((updater) => updater === onDappUpdate);
  if (index !== -1) {
    dappUpdaters.splice(index, 1);
  }
}

export function updateDapps(update: ApiDappUpdate) {
  dappUpdaters.forEach((onDappUpdate) => {
    onDappUpdate(update);
  });
}

export async function prepareTransaction(params: {
  to: string;
  amount?: string;
  comment?: string;
}) {
  await getCurrentAccountIdOrFail();

  const { to: toAddress, amount, comment } = params;

  await openPopupWindow();
  await waitLogin();

  onPopupUpdate({
    type: 'prepareTransaction',
    toAddress,
    amount,
    comment,
  });
}

export async function flushMemoryCache() {
  await clearCache();
}

export async function getCurrentAccountIdOrFail() {
  const accountId = await getCurrentAccountId();
  if (!accountId) {
    throw new Error('The user is not authorized in the wallet');
  }
  return accountId;
}

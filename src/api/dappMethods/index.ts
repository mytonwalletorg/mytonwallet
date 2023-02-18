import type { OnApiUpdate } from '../types';
import type { ApiDappUpdate, OnApiDappUpdate } from '../types/dappUpdates';

import { IS_EXTENSION } from '../environment';
import storage from '../storages/idb';
import { resolveDappPromise } from '../common/dappPromises';
import { getMainAccountId } from '../common/accounts';
import { clearCache } from './window';

// let onPopupUpdate: OnApiUpdate;

// Sometimes (e.g. when Dev Tools is open) dapp needs more time to subscribe to provider
const INIT_UPDATE_DELAY = 50;
const STORAGE_LAST_ACCOUNT = 'dappMethods:lastAccountId';

const dappUpdaters: OnApiDappUpdate[] = [];

let activeAccountId: string | undefined;

(async function init() {
  if (!IS_EXTENSION) {
    return;
  }

  const defaultAccountId = await storage.getItem(STORAGE_LAST_ACCOUNT) || await getMainAccountId(storage);

  // There is chance that `activateDappAccount` has already been called by now
  if (defaultAccountId && !activeAccountId) {
    activeAccountId = defaultAccountId;
  }
}());

// This method is called from `initApi` which in turn is called when popup is open
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function initDappMethods(_onPopupUpdate: OnApiUpdate) {
  // onPopupUpdate = _onPopupUpdate;
  resolveDappPromise('whenPopupReady');
}

export function activateDappAccount(accountId: string) {
  activeAccountId = accountId;

  void storage.setItem(STORAGE_LAST_ACCOUNT, accountId);
}

export function deactivateDappAccount() {
  activeAccountId = undefined;

  void storage.removeItem(STORAGE_LAST_ACCOUNT);
}

export function getActiveDappAccountId() {
  return activeAccountId;
}

export async function connectDapp(
  onDappUpdate: OnApiDappUpdate,
  onDappSendUpdates: (x: OnApiDappUpdate) => Promise<void>, // TODO Remove this when deleting the legacy provider
) {
  dappUpdaters.push(onDappUpdate);
  const isTonMagicEnabled = await storage.getItem('isTonMagicEnabled');

  function sendUpdates() {
    onDappUpdate({
      type: 'updateTonMagic',
      isEnabled: Boolean(isTonMagicEnabled),
    });

    onDappSendUpdates(onDappUpdate);
  }

  sendUpdates();
  setTimeout(sendUpdates, INIT_UPDATE_DELAY);
}

export function deactivateDapp(onDappUpdate: OnApiDappUpdate) {
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

export async function flushMemoryCache() {
  await clearCache();
}

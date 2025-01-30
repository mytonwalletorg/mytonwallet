import type {
  ApiDapp, ApiDappsState, ApiNetwork, ApiSite, ApiSiteCategory, OnApiUpdate,
} from '../types';

import { parseAccountId } from '../../util/account';
import {
  getAccountValue, removeAccountValue, removeNetworkAccountsValue, setAccountValue,
} from '../common/accounts';
import { callBackendGet } from '../common/backend';
import { isUpdaterAlive } from '../common/helpers';
import { callHook } from '../hooks';
import { storage } from '../storages';

const activeDappByAccountId: Record<string, string> = {};

let onUpdate: OnApiUpdate;

export function initDapps(_onUpdate: OnApiUpdate) {
  onUpdate = _onUpdate;
}

export function onActiveDappAccountUpdated(accountId: string) {
  const activeDappOrigin = getActiveDapp(accountId);

  onUpdate({
    type: 'updateActiveDapp',
    accountId,
    origin: activeDappOrigin,
  });
}

export function activateDapp(accountId: string, origin: string) {
  const oldAccountId = findActiveDappAccount(origin);
  activeDappByAccountId[accountId] = origin;

  // The method can be called in headless mode (tonConnect:reconnect)
  if (!onUpdate || !isUpdaterAlive(onUpdate)) {
    return;
  }

  if (oldAccountId) {
    onUpdate({
      type: 'updateActiveDapp',
      accountId: oldAccountId,
    });
  }

  onUpdate({
    type: 'updateActiveDapp',
    accountId,
    origin,
  });
}

export function getActiveDapp(accountId: string) {
  return activeDappByAccountId[accountId];
}

export function deactivateDapp(origin: string) {
  const accountId = findActiveDappAccount(origin);
  if (!accountId) {
    return false;
  }

  deactivateAccountDapp(accountId);

  return true;
}

export function findActiveDappAccount(origin: string) {
  return Object.keys(activeDappByAccountId).find((acc) => origin === activeDappByAccountId[acc]);
}

export function deactivateAccountDapp(accountId: string) {
  const activeOrigin = activeDappByAccountId[accountId];
  if (!activeOrigin) {
    return false;
  }

  delete activeDappByAccountId[accountId];

  if (onUpdate && isUpdaterAlive(onUpdate)) {
    onUpdate({
      type: 'updateActiveDapp',
      accountId,
    });
  }

  return true;
}

export function deactivateAllDapps() {
  for (const [accountId, value] of Object.entries(activeDappByAccountId)) {
    if (!value) {
      continue;
    }

    delete activeDappByAccountId[accountId];

    onUpdate({
      type: 'updateActiveDapp',
      accountId,
    });
  }
}

export function isDappActive(accountId: string, origin: string) {
  return activeDappByAccountId[accountId] === origin;
}

export async function updateDapp(accountId: string, origin: string, update: Partial<ApiDapp>) {
  const dapp = await getDapp(accountId, origin);
  await addDapp(accountId, { ...dapp!, ...update });
}

export async function getDapp(accountId: string, origin: string): Promise<ApiDapp | undefined> {
  return (await getAccountValue(accountId, 'dapps'))?.[origin];
}

export async function addDapp(accountId: string, dapp: ApiDapp) {
  const dapps = await getDappsByOrigin(accountId);
  dapps[dapp.origin] = dapp;
  await setAccountValue(accountId, 'dapps', dapps);
}

export async function deleteDapp(accountId: string, origin: string, dontNotifyDapp?: boolean) {
  const dapps = await getDappsByOrigin(accountId);
  if (!(origin in dapps)) {
    return false;
  }

  if (isDappActive(accountId, origin)) {
    deactivateAccountDapp(accountId);
  }

  delete dapps[origin];
  await setAccountValue(accountId, 'dapps', dapps);

  if (onUpdate && isUpdaterAlive(onUpdate)) {
    onUpdate({
      type: 'dappDisconnect',
      accountId,
      origin,
    });
  }

  if (!dontNotifyDapp) {
    await callHook('onDappDisconnected', accountId, origin);
  }

  await callHook('onDappsChanged');

  return true;
}

export async function deleteAllDapps(accountId: string) {
  deactivateAccountDapp(accountId);

  const origins = Object.keys(await getDappsByOrigin(accountId));
  await setAccountValue(accountId, 'dapps', {});

  origins.forEach((origin) => {
    onUpdate({
      type: 'dappDisconnect',
      accountId,
      origin,
    });
    void callHook('onDappDisconnected', accountId, origin);
  });

  await callHook('onDappsChanged');
}

export async function getDapps(accountId: string): Promise<ApiDapp[]> {
  return Object.values(await getDappsByOrigin(accountId));
}

export async function getDappsByOrigin(accountId: string): Promise<Record<string, ApiDapp>> {
  return await getAccountValue(accountId, 'dapps') || {};
}

export async function findLastConnectedAccount(network: ApiNetwork, origin: string) {
  const dapps = await getDappsState() || {};

  let connectedAt = 0;
  let lastConnectedAccountId: string | undefined;

  Object.entries(dapps).forEach(([accountId, byOrigin]) => {
    if (!(origin in byOrigin)) return;
    if (parseAccountId(accountId).network !== network) return;

    if ((byOrigin[origin].connectedAt) > connectedAt) {
      connectedAt = byOrigin[origin].connectedAt;
      lastConnectedAccountId = accountId;
    }
  });

  return lastConnectedAccountId;
}

export function getDappsState(): Promise<ApiDappsState | undefined> {
  return storage.getItem('dapps');
}

export async function removeAccountDapps(accountId: string) {
  await removeAccountValue(accountId, 'dapps');

  void callHook('onDappsChanged');
}

export async function removeAllDapps() {
  await storage.removeItem('dapps');

  await callHook('onDappsChanged');
}

export function removeNetworkDapps(network: ApiNetwork) {
  return removeNetworkAccountsValue(network, 'dapps');
}

export function getSseLastEventId(): Promise<string | undefined> {
  return storage.getItem('sseLastEventId');
}

export function setSseLastEventId(lastEventId: string) {
  return storage.setItem('sseLastEventId', lastEventId);
}

export function loadExploreSites(
  { isLandscape }: { isLandscape: boolean },
): Promise<{ categories: ApiSiteCategory[]; sites: ApiSite[] }> {
  return callBackendGet('/v2/dapp/catalog', { isLandscape });
}

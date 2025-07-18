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

let onUpdate: OnApiUpdate;

export function initDapps(_onUpdate: OnApiUpdate) {
  onUpdate = _onUpdate;
}

export async function updateDapp(accountId: string, url: string, update: Partial<ApiDapp>) {
  const dapp = await getDapp(accountId, url);
  await addDapp(accountId, { ...dapp!, ...update });
}

export async function getDapp(accountId: string, url: string): Promise<ApiDapp | undefined> {
  return (await getAccountValue(accountId, 'dapps'))?.[url];
}

export async function addDapp(accountId: string, dapp: ApiDapp) {
  const dapps = await getDappsByUrl(accountId);
  dapps[dapp.url] = dapp;
  await setAccountValue(accountId, 'dapps', dapps);
}

export async function deleteDapp(accountId: string, url: string, dontNotifyDapp?: boolean) {
  const dapps = await getDappsByUrl(accountId);
  if (!(url in dapps)) {
    return false;
  }

  delete dapps[url];
  await setAccountValue(accountId, 'dapps', dapps);

  if (onUpdate && isUpdaterAlive(onUpdate)) {
    onUpdate({
      type: 'dappDisconnect',
      accountId,
      url,
    });
  }

  if (!dontNotifyDapp) {
    await callHook('onDappDisconnected', accountId, url);
  }

  await callHook('onDappsChanged');

  return true;
}

export async function deleteAllDapps(accountId: string) {
  const urls = Object.keys(await getDappsByUrl(accountId));
  await setAccountValue(accountId, 'dapps', {});

  urls.forEach((url) => {
    onUpdate({
      type: 'dappDisconnect',
      accountId,
      url,
    });
    void callHook('onDappDisconnected', accountId, url);
  });

  await callHook('onDappsChanged');
}

export async function getDapps(accountId: string): Promise<ApiDapp[]> {
  return Object.values(await getDappsByUrl(accountId));
}

export async function getDappsByUrl(accountId: string): Promise<Record<string, ApiDapp>> {
  return await getAccountValue(accountId, 'dapps') || {};
}

export async function findLastConnectedAccount(network: ApiNetwork, url: string) {
  const dapps = await getDappsState() || {};

  let connectedAt = 0;
  let lastConnectedAccountId: string | undefined;

  Object.entries(dapps).forEach(([accountId, byUrl]) => {
    if (!(url in byUrl)) return;
    if (parseAccountId(accountId).network !== network) return;

    if ((byUrl[url].connectedAt) > connectedAt) {
      connectedAt = byUrl[url].connectedAt;
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

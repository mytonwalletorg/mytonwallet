import { ApiDapp, OnApiUpdate } from '../types';
import { getAccountValue, setAccountValue } from '../common/accounts';
import { Storage } from '../storages/types';
import { toInternalAccountId } from '../common/helpers';

const DAPPS_STORAGE_KEY = 'dapps';
const activeDappByAccountId: Record<string, string | undefined> = {};

let onUpdate: OnApiUpdate;
let storage: Storage;

export function initDapps(_onUpdate: OnApiUpdate, _storage: Storage) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onUpdate = _onUpdate;
  storage = _storage;
}

export function activateDapp(accountId: string, origin: string) {
  activeDappByAccountId[accountId] = origin;

  onUpdate({
    type: 'updateActiveDapp',
    accountId,
    origin,
  });
}

export function getActiveDapp(accountId: string) {
  return activeDappByAccountId[accountId];
}

export function deactivateDapp(accountId: string, origin?: string) {
  if (origin && !isDappActive(accountId, origin)) {
    return;
  }

  activeDappByAccountId[accountId] = undefined;

  onUpdate({
    type: 'updateActiveDapp',
    accountId,
  });
}

export function deactivateAllDapps() {
  for (const accountId of Object.keys(activeDappByAccountId)) {
    delete activeDappByAccountId[accountId];
  }
}

export function isDappActive(accountId: string, origin: string) {
  return activeDappByAccountId[accountId] === origin;
}

export async function addDapp(accountId: string, dapp: ApiDapp) {
  const dapps = await getDappsByOrigin(accountId);
  dapps[dapp.origin] = dapp;
  await setAccountValue(storage, accountId, DAPPS_STORAGE_KEY, dapps);
}

export async function addDappToAccounts(dapp: ApiDapp, accountIds: string[]) {
  const data = await storage.getItem(DAPPS_STORAGE_KEY);
  const dappsByAccount = data ? JSON.parse(data) : {};

  accountIds.forEach((accountId) => {
    const internalId = toInternalAccountId(accountId);
    const dapps = dappsByAccount[internalId] || {};
    dapps[dapp.origin] = dapp;

    dappsByAccount[internalId] = dapps;
  });
  await storage.setItem(DAPPS_STORAGE_KEY, JSON.stringify(dappsByAccount));
}

export async function deleteDapp(accountId: string, origin: string) {
  deactivateDapp(accountId, origin);

  const dapps = await getDappsByOrigin(accountId);
  if (origin in dapps) {
    delete dapps[origin];
    await setAccountValue(storage, accountId, DAPPS_STORAGE_KEY, dapps);

    onUpdate({
      type: 'dappDisconnect',
      accountId,
      origin,
    });
  }
}

export async function deleteAllDapps(accountId: string) {
  deactivateDapp(accountId);

  const origins = Object.keys(await getDappsByOrigin(accountId));
  await setAccountValue(storage, accountId, DAPPS_STORAGE_KEY, {});

  origins.forEach((origin) => {
    onUpdate({
      type: 'dappDisconnect',
      accountId,
      origin,
    });
  });
}

export async function getDapps(accountId: string): Promise<ApiDapp[]> {
  return Object.values(await getDappsByOrigin(accountId));
}

export async function getDappsByOrigin(accountId: string): Promise<Record<string, ApiDapp>> {
  return (await getAccountValue(storage, accountId, DAPPS_STORAGE_KEY)) || {};
}

export async function isDappConnected(accountId: string, origin: string) {
  const dapps = await getDappsByOrigin(accountId);

  return Object.values(dapps).some((dapp) => dapp.origin === origin);
}

import { ApiDapp, OnApiUpdate } from '../types';
import { getAccountValue, setAccountValue } from '../common/accounts';
import { Storage } from '../storages/types';
import { toInternalAccountId } from '../common/helpers';

const DAPPS_STORAGE_KEY = 'dapps';
const activeDappByAccountId: Record<string, string> = {};

let onUpdate: OnApiUpdate;
let storage: Storage;

export function initDapps(_onUpdate: OnApiUpdate, _storage: Storage) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onUpdate = _onUpdate;
  storage = _storage;
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
  const oldAccountId = findConnectedAccountByDapp(origin);
  if (oldAccountId && toInternalAccountId(oldAccountId) !== toInternalAccountId(accountId)) {
    throw new Error(`The app '${origin}' is already connected to another account`);
  }

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

export function deactivateDapp(origin: string) {
  const accountId = findConnectedAccountByDapp(origin);
  if (!accountId) {
    return false;
  }

  deactivateAccountDapp(accountId);

  return true;
}

export function findConnectedAccountByDapp(origin: string) {
  return Object.keys(activeDappByAccountId).find((acc) => origin === activeDappByAccountId[acc]);
}

export function deactivateAccountDapp(accountId: string) {
  const activeOrigin = activeDappByAccountId[accountId];
  if (!activeOrigin) {
    return false;
  }

  delete activeDappByAccountId[accountId];

  onUpdate({
    type: 'updateActiveDapp',
    accountId,
  });

  return true;
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
  const dappsByAccount = await storage.getItem(DAPPS_STORAGE_KEY) || {};

  accountIds.forEach((accountId) => {
    const internalId = toInternalAccountId(accountId);
    const dapps = dappsByAccount[internalId] || {};
    dapps[dapp.origin] = dapp;

    dappsByAccount[internalId] = dapps;
  });
  await storage.setItem(DAPPS_STORAGE_KEY, dappsByAccount);
}

export async function deleteDapp(accountId: string, origin: string) {
  const dapps = await getDappsByOrigin(accountId);
  if (!(origin in dapps)) {
    return false;
  }

  if (isDappActive(accountId, origin)) {
    deactivateAccountDapp(accountId);
  }

  delete dapps[origin];
  await setAccountValue(storage, accountId, DAPPS_STORAGE_KEY, dapps);

  onUpdate({
    type: 'dappDisconnect',
    accountId,
    origin,
  });

  return true;
}

export async function deleteAllDapps(accountId: string) {
  deactivateAccountDapp(accountId);

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

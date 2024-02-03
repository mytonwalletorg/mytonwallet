import type { StorageKey } from '../storages/types';
import type { ApiAccount, ApiNetwork } from '../types';

import { buildAccountId, parseAccountId } from '../../util/account';
import { storage } from '../storages';

const MIN_ACCOUNT_NUMBER = 0;

// eslint-disable-next-line import/no-mutable-exports
export let loginResolve: AnyFunction;
const loginPromise = new Promise<void>((resolve) => {
  loginResolve = resolve;
});

export async function getAccountIds(): Promise<string[]> {
  return Object.keys(await storage.getItem('accounts') || {});
}

export async function getAccountIdWithMnemonic() {
  const byId = await fetchStoredAccounts();

  return Object.entries(byId).find(([,account]) => !account.ledger)?.[0];
}

export async function getNewAccountId(network: ApiNetwork) {
  const ids = (await getAccountIds()).map((accountId) => parseAccountId(accountId).id);
  const id = ids.length === 0 ? MIN_ACCOUNT_NUMBER : Math.max(...ids) + 1;
  return buildAccountId({
    id,
    network,
    blockchain: 'ton',
  });
}

export async function fetchStoredPublicKey(accountId: string): Promise<string> {
  return (await fetchStoredAccount(accountId)).publicKey;
}

export async function fetchStoredAddress(accountId: string): Promise<string> {
  return (await fetchStoredAccount(accountId)).address;
}

export function fetchStoredAccount(accountId: string): Promise<ApiAccount> {
  return getAccountValue(accountId, 'accounts');
}

export function fetchStoredAccounts(): Promise<Record<string, ApiAccount>> {
  return storage.getItem('accounts');
}

export async function updateStoredAccount(accountId: string, partial: Partial<ApiAccount>): Promise<void> {
  const account = await fetchStoredAccount(accountId);
  return setAccountValue(accountId, 'accounts', {
    ...account,
    ...partial,
  });
}

export async function getAccountValue(accountId: string, key: StorageKey) {
  return (await storage.getItem(key))?.[accountId];
}

export async function removeAccountValue(accountId: string, key: StorageKey) {
  const data = await storage.getItem(key);
  if (!data) return;

  const { [accountId]: removedValue, ...restData } = data;
  await storage.setItem(key, restData);
}

export async function setAccountValue(accountId: string, key: StorageKey, value: any) {
  const data = await storage.getItem(key);
  await storage.setItem(key, { ...data, [accountId]: value });
}

export async function removeNetworkAccountsValue(network: string, key: StorageKey) {
  const data = await storage.getItem(key);
  if (!data) return;

  for (const accountId of Object.keys(data)) {
    if (parseAccountId(accountId).network === network) {
      delete data[accountId];
    }
  }

  await storage.setItem(key, data);
}

export async function getCurrentNetwork() {
  const accountId = await getCurrentAccountId();
  if (!accountId) return undefined;
  return parseAccountId(accountId).network;
}

export async function getCurrentAccountIdOrFail() {
  const accountId = await getCurrentAccountId();
  if (!accountId) {
    throw new Error('The user is not authorized in the wallet');
  }
  return accountId;
}

export function getCurrentAccountId(): Promise<string | undefined> {
  return storage.getItem('currentAccountId');
}

export function waitLogin() {
  return loginPromise;
}

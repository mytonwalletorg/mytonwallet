import type { StorageKey } from '../storages/types';
import type { ApiAccountInfo, ApiNetwork } from '../types';

import { buildAccountId, parseAccountId } from '../../util/account';
import { buildCollectionByKey } from '../../util/iteratees';
import { storage } from '../storages';
import { toInternalAccountId } from './helpers';

const MIN_ACCOUNT_NUMBER = 0;

// eslint-disable-next-line import/no-mutable-exports
export let loginResolve: AnyFunction;
const loginPromise = new Promise<void>((resolve) => {
  loginResolve = resolve;
});

export async function getAccountIds(): Promise<string[]> {
  return Object.keys(await storage.getItem('addresses') || {});
}

export async function getMainAccountId() {
  const accountIds = await getAccountIds();

  const accounts = await Promise.all(
    accountIds.map(async (accountId) => {
      const info = await fetchStoredAccount(accountId);
      return {
        ...parseAccountId(accountId),
        accountId,
        hasLedger: !!info?.ledger,
      };
    }),
  );

  const nonHardwareAccounts = accounts.filter((account) => !account.hasLedger);

  if (!nonHardwareAccounts.length) {
    return undefined;
  }

  const accountById = buildCollectionByKey(
    nonHardwareAccounts,
    'id',
  );

  const keys = Object.keys(accountById);
  if (!keys.length) {
    return undefined;
  }

  const id = Math.min(...keys.map(Number));

  return accountById[id].accountId;
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

export function fetchStoredAccount(accountId: string): Promise<ApiAccountInfo | undefined> {
  return getAccountValue(accountId, 'accounts');
}

export function fetchStoredPublicKey(accountId: string): Promise<string> {
  return getAccountValue(accountId, 'publicKeys');
}

export function fetchStoredAddress(accountId: string): Promise<string> {
  return getAccountValue(accountId, 'addresses');
}

export async function getAccountValue(accountId: string, key: StorageKey) {
  const internalId = toInternalAccountId(accountId);
  return (await storage.getItem(key))?.[internalId];
}

export async function removeAccountValue(accountId: string, key: StorageKey) {
  const internalId = toInternalAccountId(accountId);
  const data = await storage.getItem(key);
  if (!data) return;

  const { [internalId]: removedValue, ...restData } = data;
  await storage.setItem(key, restData);
}

export async function setAccountValue(accountId: string, key: StorageKey, value: any) {
  const internalId = toInternalAccountId(accountId);
  const data = await storage.getItem(key);
  await storage.setItem(key, { ...data, [internalId]: value });
}

export function getCurrentAccountId(): Promise<string | undefined> {
  return storage.getItem('currentAccountId');
}

export function waitLogin() {
  return loginPromise;
}

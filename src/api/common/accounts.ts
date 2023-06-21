import type { Storage, StorageKey } from '../storages/types';
import type { ApiAccountInfo, ApiNetwork } from '../types';

import { buildAccountId, parseAccountId } from '../../util/account';
import { buildCollectionByKey } from '../../util/iteratees';
import { toInternalAccountId } from './helpers';

const MIN_ACCOUNT_NUMBER = 0;

export async function getAccountIds(storage: Storage): Promise<string[]> {
  return Object.keys(await storage.getItem('addresses') || {});
}

export async function getMainAccountId(storage: Storage) {
  const accountIds = await getAccountIds(storage);

  const accounts = await Promise.all(
    accountIds.map(async (accountId) => {
      const info = await fetchStoredAccount(storage, accountId);
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

export async function getNewAccountId(storage: Storage, network: ApiNetwork) {
  const ids = (await getAccountIds(storage)).map((accountId) => parseAccountId(accountId).id);
  const id = ids.length === 0 ? MIN_ACCOUNT_NUMBER : Math.max(...ids) + 1;
  return buildAccountId({
    id,
    network,
    blockchain: 'ton',
  });
}

export function fetchStoredAccount(storage: Storage, accountId: string): Promise<ApiAccountInfo | undefined> {
  return getAccountValue(storage, accountId, 'accounts');
}

export function fetchStoredPublicKey(storage: Storage, accountId: string): Promise<string> {
  return getAccountValue(storage, accountId, 'publicKeys');
}

export function fetchStoredAddress(storage: Storage, accountId: string): Promise<string> {
  return getAccountValue(storage, accountId, 'addresses');
}

export async function getAccountValue(storage: Storage, accountId: string, key: StorageKey) {
  const internalId = toInternalAccountId(accountId);
  return (await storage.getItem(key))?.[internalId];
}

export async function removeAccountValue(storage: Storage, accountId: string, key: StorageKey) {
  const internalId = toInternalAccountId(accountId);
  const data = await storage.getItem(key);
  if (!data) return;

  const { [internalId]: removedValue, ...restData } = data;
  await storage.setItem(key, restData);
}

export async function setAccountValue(storage: Storage, accountId: string, key: StorageKey, value: any) {
  const internalId = toInternalAccountId(accountId);
  const data = await storage.getItem(key);
  await storage.setItem(key, { ...data, [internalId]: value });
}

import { ApiNetwork } from '../types';
import { Storage } from '../storages/types';

import { buildAccountId, parseAccountId } from '../../util/account';
import { buildCollectionByKey } from '../../util/iteratees';

import { toInternalAccountId } from './helpers';

const MIN_ACCOUNT_NUMBER = 0;

export async function getAccountIds(storage: Storage): Promise<string[]> {
  return Object.keys(await storage.getItem('addresses') || {});
}

export async function getMainAccountId(storage: Storage) {
  const accountById = buildCollectionByKey(
    (await getAccountIds(storage)).map((accountId) => ({
      ...parseAccountId(accountId),
      accountId,
    })),
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

export async function getAccountValue(storage: Storage, accountId: string, key: string) {
  const internalId = toInternalAccountId(accountId);
  return (await storage.getItem(key))?.[internalId];
}

export async function removeAccountValue(storage: Storage, accountId: string, key: string) {
  const internalId = toInternalAccountId(accountId);
  const data = await storage.getItem(key);
  if (!data) return;

  const { [internalId]: removedValue, ...restData } = data;
  await storage.setItem(key, restData);
}

export async function setAccountValue(storage: Storage, accountId: string, key: string, value: any) {
  const internalId = toInternalAccountId(accountId);
  const data = await storage.getItem(key);
  await storage.setItem(key, { ...data, [internalId]: value });
}

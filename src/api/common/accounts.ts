import { ApiNetwork } from '../types';
import { Storage } from '../storages/types';

import { buildAccountId, parseAccountId } from '../../util/account';
import { buildCollectionByKey } from '../../util/iteratees';

import { toInternalAccountId } from './helpers';

const MIN_ACCOUNT_NUMBER = 0;

export async function getAccountIds(storage: Storage): Promise<string[]> {
  return Object.keys(JSON.parse(await storage.getItem('addresses') || '{}'));
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

export async function removeAccountValue(storage: Storage, accountId: string, item: string) {
  const internalId = toInternalAccountId(accountId);
  const data = JSON.parse(await storage.getItem(item));
  if (internalId in data) {
    delete data[internalId];
    await storage.setItem(item, JSON.stringify(data));
  }
}

export async function setAccountValue(storage: Storage, accountId: string, item: string, value: any) {
  const internalId = toInternalAccountId(accountId);
  await storage.setItem(item, JSON.stringify({
    ...JSON.parse(await storage.getItem(item) || '{}'),
    [internalId]: value,
  }));
}

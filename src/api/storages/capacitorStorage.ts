import type { Storage, StorageKey } from './types';

import { bigintReviver } from '../../util/bigint';
import { callWindow } from '../../util/capacitorStorageProxy/connector';

const NON_CACHED_KEYS: StorageKey[] = ['mnemonicsEncrypted'];
let cache: AnyLiteral = {};

const storage: Storage = {
  async getItem(key: StorageKey, force?: boolean) {
    if (key in cache && !force) return cache[key];

    const result = await callWindow('getItem', key);
    const value = result ? JSON.parse(result, bigintReviver) : undefined;

    if (value !== undefined && !NON_CACHED_KEYS.includes(key)) cache[key] = value;

    return value;
  },

  async setItem(key: StorageKey, value: any) {
    await callWindow('setItem', key, JSON.stringify(value));

    if (!NON_CACHED_KEYS.includes(key)) cache[key] = value;
  },

  async removeItem(key: StorageKey) {
    await callWindow('removeItem', key);

    delete cache[key];
  },

  async clear() {
    await callWindow('clear');

    cache = {};
  },
};

export default storage;

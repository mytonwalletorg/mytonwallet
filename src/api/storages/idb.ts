import * as idb from 'idb-keyval';

import type { Storage, StorageKey } from './types';

import { INDEXED_DB_NAME, INDEXED_DB_STORE_NAME } from '../../config';
import { fromKeyValueArrays } from '../../util/iteratees';

const store = idb.createStore(INDEXED_DB_NAME, INDEXED_DB_STORE_NAME);

export default {
  getItem: (name: StorageKey) => idb.get(name, store),
  setItem: (name: StorageKey, value: any) => idb.set(name, value, store),
  removeItem: (name: StorageKey) => idb.del(name, store),
  clear: () => idb.clear(store),
  getAll: async () => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const keys = (await idb.keys(store)) as string[];
    const values = await idb.getMany(keys, store);
    return fromKeyValueArrays(keys, values);
  },
  getMany: async (keys) => {
    const values = await idb.getMany(keys, store);
    return fromKeyValueArrays(keys, values);
  },
  setMany: (items) => {
    return idb.setMany(Object.entries(items), store);
  },
} as Storage;

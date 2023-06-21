import * as idb from 'idb-keyval';

import type { Storage } from './types';

import { fromKeyValueArrays } from '../../util/iteratees';

export default {
  getItem: idb.get,
  setItem: idb.set,
  removeItem: idb.del,
  clear: idb.clear,
  getAll: async () => {
    const keys = await idb.keys() as string[];
    const values = await idb.getMany(keys);
    return fromKeyValueArrays(keys, values);
  },
  getMany: async (keys) => {
    const values = await idb.getMany(keys);
    return fromKeyValueArrays(keys, values);
  },
  setMany: (items) => {
    return idb.setMany(Object.entries(items));
  },
} as Storage;

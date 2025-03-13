import type { Storage, StorageKey } from './types';

import { pick } from '../../util/iteratees';
import { callWindow } from '../../util/windowProvider/connector';

function withPromise(fn: AnyFunction) {
  return (...args: any) => Promise.resolve(fn(...args));
}

const storage: Storage = (typeof localStorage === 'object' ? {
  getItem: withPromise(localStorage.getItem),
  setItem: withPromise(localStorage.setItem),
  removeItem: withPromise(localStorage.removeItem),
  clear: withPromise(localStorage.clear),
  getAll: withPromise(() => ({ ...localStorage })),
  getMany: withPromise((keys: string[]) => pick(localStorage, keys)),
  setMany: withPromise((items: AnyLiteral) => {
    Object.assign(localStorage, items);
  }),
} : {
  getItem(key: StorageKey) {
    return callWindow('localStorageGetItem', key);
  },
  setItem(key: StorageKey, value: any) {
    return callWindow('localStorageSetItem', key, value);
  },
  removeItem(key: StorageKey) {
    return callWindow('localStorageRemoveItem', key);
  },
  clear() {
    return callWindow('localStorageClear');
  },
  getAll() {
    return callWindow('localStorageGetAll');
  },
  getMany(keys: StorageKey[]) {
    return callWindow('localStorageGetMany', keys);
  },
  setMany(items: AnyLiteral) {
    return callWindow('localStorageSetMany', items);
  },
});

export default storage;

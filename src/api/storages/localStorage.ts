import type { Storage } from './types';

import { pick } from '../../util/iteratees';

function withPromise(fn: AnyFunction) {
  return (...args: any) => Promise.resolve(fn(...args));
}

export default (typeof localStorage === 'object' ? {
  getItem: withPromise(localStorage.getItem),
  setItem: localStorage.setItem,
  removeItem: localStorage.removeItem,
  clear: localStorage.clear,
  getAll: withPromise(() => ({ ...localStorage })),
  getMany: withPromise((keys: string[]) => pick(localStorage, keys)),
  setMany: (items: AnyLiteral) => {
    Object.assign(localStorage, items);
  },
} : {}) as Storage;

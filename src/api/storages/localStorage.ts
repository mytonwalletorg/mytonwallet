import { Storage } from './types';

function withPromise(fn: AnyFunction) {
  return (...args: any) => Promise.resolve(fn(...args));
}

export default (typeof localStorage === 'object' ? {
  getItem: withPromise(localStorage.getItem),
  setItem: localStorage.setItem,
  removeItem: localStorage.removeItem,
  clear: localStorage.clear,
} : {}) as Storage;

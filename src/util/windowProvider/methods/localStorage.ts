import { pick } from '../../iteratees';

export function localStorageGetItem(key: string) {
  return localStorage.getItem(key);
}

export function localStorageSetItem(key: string, value: string) {
  return localStorage.setItem(key, value);
}

export function localStorageRemoveItem(key: string) {
  return localStorage.removeItem(key);
}

export function localStorageClear() {
  return localStorage.clear();
}

export function localStorageGetAll() {
  return { ...localStorage };
}

export function localStorageGetMany(keys: string[]) {
  return pick(localStorage, keys);
}

export function localStorageSetMany(items: AnyLiteral) {
  Object.assign(localStorage, items);
}

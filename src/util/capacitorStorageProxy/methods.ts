import type { SecureStoragePluginPlugin } from 'capacitor-secure-storage-plugin';

import type { StorageKey } from '../../api/storages/types';

let SecureStoragePlugin: SecureStoragePluginPlugin | undefined;
let resolvePromise: AnyFunction;

const promise = new Promise((resolve) => {
  resolvePromise = resolve;
});

export async function init() {
  if (SecureStoragePlugin) return;
  ({ SecureStoragePlugin } = await import(
    /* webpackChunkName: "capacitorSecureStorage" */ 'capacitor-secure-storage-plugin'
  ));
  resolvePromise();
}

export async function getItem(key: StorageKey) {
  await promise;
  return (await SecureStoragePlugin!.get({ key }).catch((err) => {
    const message = typeof err === 'string' ? err : err.message;
    if (message.includes('key does not exist')) {
      return undefined;
    } else {
      throw err;
    }
  }))?.value;
}

export async function setItem(key: StorageKey, value: string) {
  await promise;
  return SecureStoragePlugin!.set({ key, value });
}

export async function removeItem(key: StorageKey) {
  await promise;
  return SecureStoragePlugin!.remove({ key });
}

export async function clear() {
  await promise;
  return SecureStoragePlugin!.clear();
}

export async function keys() {
  await promise;
  return SecureStoragePlugin!.keys();
}

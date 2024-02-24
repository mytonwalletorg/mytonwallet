import type { SecureStoragePluginPlugin } from 'capacitor-secure-storage-plugin';

import type { StorageKey } from '../../api/storages/types';

let SecureStoragePlugin: SecureStoragePluginPlugin | undefined;
let resolvePromise: AnyFunction;

const promise = new Promise((resolve) => {
  resolvePromise = resolve;
});

export async function init() {
  ({ SecureStoragePlugin } = await import(
    /* webpackChunkName: "capacitorSecureStorage" */ 'capacitor-secure-storage-plugin'
  ));
  resolvePromise();
}

export async function getItem(key: StorageKey) {
  await promise;
  return (await SecureStoragePlugin!.get({ key }).catch(() => undefined))?.value;
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

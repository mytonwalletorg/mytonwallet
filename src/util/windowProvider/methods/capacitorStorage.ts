import type { SecureStoragePluginPlugin } from 'capacitor-secure-storage-plugin';

import type { StorageKey } from '../../../api/storages/types';

import { IS_CAPACITOR } from '../../../config';

let SecureStoragePlugin: SecureStoragePluginPlugin | undefined;
let resolvePromise: AnyFunction;

const promise = new Promise((resolve) => {
  resolvePromise = resolve;
});

export async function init() {
  if (IS_CAPACITOR && !SecureStoragePlugin) {
    ({ SecureStoragePlugin } = await import(
      /* webpackChunkName: "capacitorSecureStorage" */ 'capacitor-secure-storage-plugin',
    ));
    resolvePromise();
  }
}

export async function capacitorStorageGetItem(key: StorageKey) {
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

export async function capacitorStorageSetItem(key: StorageKey, value: string) {
  await promise;
  return SecureStoragePlugin!.set({ key, value });
}

export async function capacitorStorageRemoveItem(key: StorageKey) {
  await promise;
  return SecureStoragePlugin!.remove({ key });
}

export async function capacitorStorageClear() {
  await promise;
  return SecureStoragePlugin!.clear();
}

export async function capacitorStorageKeys() {
  await promise;
  return SecureStoragePlugin!.keys();
}

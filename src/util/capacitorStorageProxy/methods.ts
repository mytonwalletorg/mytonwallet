import type { SecureStoragePluginPlugin } from 'capacitor-secure-storage-plugin';

import type { StorageKey } from '../../api/storages/types';

let SecureStoragePlugin: SecureStoragePluginPlugin;

export async function init() {
  ({ SecureStoragePlugin } = await import(
    /* webpackChunkName: "capacitorSecureStorage" */ 'capacitor-secure-storage-plugin'
  ));
}

export async function getItem(key: StorageKey) {
  return (await SecureStoragePlugin.get({ key }).catch(() => undefined))?.value;
}

export function setItem(key: StorageKey, value: string) {
  return SecureStoragePlugin.set({ key, value });
}

export function removeItem(key: StorageKey) {
  return SecureStoragePlugin.remove({ key });
}

export function clear() {
  return SecureStoragePlugin.clear();
}

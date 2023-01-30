import { OnApiUpdate } from '../types';
import { Storage } from '../storages/types';

import { migrateStorage } from '../common/helpers';

import * as dappMethods from '../dappMethods';
import { setupBalancePolling, setupPoolStatePolling } from './polling';

// let onUpdate: OnApiUpdate;
let storage: Storage;
let activeAccountId: string | undefined;

export function initAccounts(_onUpdate: OnApiUpdate, _storage: Storage) {
  // onUpdate = _onUpdate;
  storage = _storage;
}

export async function switchAccount(accountId: string, newestTxId?: string) {
  deactivateAccount();
  await activateAccount(accountId, newestTxId);
}

export async function activateAccount(accountId: string, newestTxId?: string) {
  await migrateStorage(storage);

  activeAccountId = accountId;
  dappMethods.activateDappAccount(accountId);

  void setupBalancePolling(accountId, newestTxId);
  void setupPoolStatePolling(accountId);
}

export function deactivateAccount() {
  dappMethods.deactivateDappAccount();
  activeAccountId = undefined;
}

export function isAccountActive(accountId: string) {
  return activeAccountId === accountId;
}

import { ApiTxIdBySlug, OnApiUpdate } from '../types';
import { Storage } from '../storages/types';

import { waitStorageMigration } from '../common/helpers';

import * as dappMethods from '../dappMethods';
import { setupBalancePolling, setupBackendStakingStatePolling, sendUpdateTokens } from './polling';
import { deactivateAccountDapp, deactivateAllDapps, onActiveDappAccountUpdated } from './dapps';
import { IS_EXTENSION } from '../environment';
import { clearExtensionFeatures, setupDefaultExtensionFeatures } from './extension';

// let onUpdate: OnApiUpdate;
// let storage: Storage;
let activeAccountId: string | undefined;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function initAccounts(_onUpdate: OnApiUpdate, _storage: Storage) {
  // onUpdate = _onUpdate;
  // storage = _storage;
}

export async function activateAccount(accountId: string, newestTxIds?: ApiTxIdBySlug) {
  await waitStorageMigration();

  const isFirstLogin = !activeAccountId;

  activeAccountId = accountId;

  if (IS_EXTENSION) {
    if (isFirstLogin) {
      setupDefaultExtensionFeatures();
    }

    dappMethods.activateDappAccount(accountId);
    onActiveDappAccountUpdated(accountId);
  }

  if (isFirstLogin) {
    sendUpdateTokens();
  }

  void setupBalancePolling(accountId, newestTxIds);
  void setupBackendStakingStatePolling(accountId);
}

export function deactivateAllAccounts() {
  deactivateCurrentAccount();
  activeAccountId = undefined;

  if (IS_EXTENSION) {
    deactivateAllDapps();
    void clearExtensionFeatures();
  }
}

export function deactivateCurrentAccount() {
  if (IS_EXTENSION) {
    dappMethods.deactivateDappAccount();
    deactivateAccountDapp(activeAccountId!);
  }
}

export function isAccountActive(accountId: string) {
  return activeAccountId === accountId;
}

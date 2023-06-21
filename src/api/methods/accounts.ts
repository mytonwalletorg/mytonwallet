import type { Storage } from '../storages/types';
import type {
  ApiAccountInfo, ApiTxIdBySlug, OnApiUpdate,
} from '../types';

import { parseAccountId } from '../../util/account';
import { fetchStoredAccount } from '../common/accounts';
import { waitStorageMigration } from '../common/helpers';
import * as dappMethods from '../dappMethods';
import { IS_EXTENSION } from '../environment';
import { deactivateAccountDapp, deactivateAllDapps, onActiveDappAccountUpdated } from './dapps';
import { clearExtensionFeatures, setupDefaultExtensionFeatures } from './extension';
import { sendUpdateTokens, setupBackendStakingStatePolling, setupBalancePolling } from './polling';

// let onUpdate: OnApiUpdate;
let storage: Storage;
let activeAccountId: string | undefined;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function initAccounts(_onUpdate: OnApiUpdate, _storage: Storage) {
  // onUpdate = _onUpdate;
  storage = _storage;
}

export async function activateAccount(accountId: string, newestTxIds?: ApiTxIdBySlug) {
  await waitStorageMigration();

  const prevAccountId = activeAccountId;
  const isFirstLogin = !prevAccountId;

  activeAccountId = accountId;

  if (IS_EXTENSION) {
    if (prevAccountId && parseAccountId(prevAccountId).network !== parseAccountId(accountId).network) {
      deactivateAllDapps();
    }

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

export function fetchAccount(accountId: string): Promise<ApiAccountInfo | undefined> {
  return fetchStoredAccount(storage, accountId);
}

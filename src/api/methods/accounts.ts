import type { ApiAccountInfo, ApiTxIdBySlug } from '../types';

import { IS_EXTENSION } from '../../config';
import { parseAccountId } from '../../util/account';
import { fetchStoredAccount, loginResolve } from '../common/accounts';
import { waitStorageMigration } from '../common/helpers';
import { storage } from '../storages';
import { deactivateAccountDapp, deactivateAllDapps, onActiveDappAccountUpdated } from './dapps';
import {
  sendUpdateTokens,
  setupBackendStakingStatePolling,
  setupBalanceBasedPolling,
} from './polling';

import { callHook } from '../hooks';

let activeAccountId: string | undefined;

export async function activateAccount(accountId: string, newestTxIds?: ApiTxIdBySlug) {
  await waitStorageMigration();

  const prevAccountId = activeAccountId;
  const isFirstLogin = !prevAccountId;

  activeAccountId = accountId;
  await storage.setItem('currentAccountId', accountId);
  loginResolve();

  if (IS_EXTENSION) {
    if (prevAccountId && parseAccountId(prevAccountId).network !== parseAccountId(accountId).network) {
      deactivateAllDapps();
    }

    callHook('onFirstLogin');

    onActiveDappAccountUpdated(accountId);
  }

  if (isFirstLogin) {
    sendUpdateTokens();
  }

  void setupBalanceBasedPolling(accountId, newestTxIds);
  void setupBackendStakingStatePolling(accountId);
}

export function deactivateAllAccounts() {
  deactivateCurrentAccount();
  activeAccountId = undefined;

  if (IS_EXTENSION) {
    deactivateAllDapps();
    callHook('onFullLogout');
  }
}

export function deactivateCurrentAccount() {
  if (IS_EXTENSION) {
    deactivateAccountDapp(activeAccountId!);
  }
}

export function isAccountActive(accountId: string) {
  return activeAccountId === accountId;
}

export function fetchAccount(accountId: string): Promise<ApiAccountInfo | undefined> {
  return fetchStoredAccount(accountId);
}

export function getActiveAccountId() {
  return activeAccountId;
}

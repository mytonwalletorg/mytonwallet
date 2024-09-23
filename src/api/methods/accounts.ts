import type {
  ApiChain, ApiLedgerAccount, ApiTonWallet, ApiTxTimestamps, OnApiUpdate,
} from '../types';

import { getChainConfig, IS_EXTENSION } from '../../config';
import { parseAccountId } from '../../util/account';
import chains from '../chains';
import {
  fetchStoredAccount,
  fetchStoredTonWallet,
  getActiveAccountId,
  loginResolve,
  setActiveAccountId,
} from '../common/accounts';
import { waitStorageMigration } from '../common/helpers';
import { sendUpdateTokens } from '../common/tokens';
import { callHook } from '../hooks';
import { storage } from '../storages';
import { deactivateAccountDapp, deactivateAllDapps, onActiveDappAccountUpdated } from './dapps';

const { ton, tron } = chains;

let onUpdate: OnApiUpdate;

export function initAccounts(_onUpdate: OnApiUpdate) {
  onUpdate = _onUpdate;
}

export async function activateAccount(accountId: string, newestTxTimestamps: ApiTxTimestamps = {}) {
  await waitStorageMigration();

  const prevAccountId = getActiveAccountId();
  const isFirstLogin = !prevAccountId;

  setActiveAccountId(accountId);
  await storage.setItem('currentAccountId', accountId);
  loginResolve();

  if (IS_EXTENSION) {
    if (prevAccountId && parseAccountId(prevAccountId).network !== parseAccountId(accountId).network) {
      deactivateAllDapps();
    }

    void callHook('onFirstLogin');
    onActiveDappAccountUpdated(accountId);
  }

  if (isFirstLogin) {
    sendUpdateTokens(onUpdate);
  }

  const account = await fetchStoredAccount(accountId);

  if ('ton' in account) ton.setupPolling(accountId, onUpdate, pickChainTimestamps(newestTxTimestamps, 'ton'));
  if ('tron' in account) void tron.setupPolling(accountId, onUpdate, pickChainTimestamps(newestTxTimestamps, 'tron'));
}

function pickChainTimestamps(bySlug: ApiTxTimestamps, chain: ApiChain) {
  const { slug: nativeSlug } = getChainConfig(chain).nativeToken;
  return Object.entries(bySlug).reduce((newBySlug, [slug, timestamp]) => {
    if (slug === nativeSlug || slug.startsWith(`${chain}-`)) {
      newBySlug[slug] = timestamp;
    }
    return newBySlug;
  }, {} as ApiTxTimestamps);
}

export function deactivateAllAccounts() {
  deactivateCurrentAccount();
  setActiveAccountId(undefined);

  if (IS_EXTENSION) {
    deactivateAllDapps();
    void callHook('onFullLogout');
  }
}

export function deactivateCurrentAccount() {
  if (IS_EXTENSION) {
    deactivateAccountDapp(getActiveAccountId()!);
  }
}

export function fetchTonWallet(accountId: string): Promise<ApiTonWallet> {
  return fetchStoredTonWallet(accountId);
}

export function fetchLedgerAccount(accountId: string) {
  return fetchStoredAccount<ApiLedgerAccount>(accountId);
}

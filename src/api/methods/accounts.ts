import type {
  ApiActivityTimestamps, ApiChain, ApiLedgerAccount, ApiTonWallet, OnApiUpdate,
} from '../types';

import { IS_CORE_WALLET, IS_EXTENSION } from '../../config';
import { getChainConfig } from '../../util/chain';
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
import { setupAccountConfigPolling } from './polling';

const { ton, tron } = chains;

let onUpdate: OnApiUpdate;

export function initAccounts(_onUpdate: OnApiUpdate) {
  onUpdate = _onUpdate;
}

export async function activateAccount(accountId: string, newestActivityTimestamps: ApiActivityTimestamps = {}) {
  await waitStorageMigration();

  const prevAccountId = getActiveAccountId();
  const isFirstLogin = !prevAccountId;

  setActiveAccountId(accountId);
  await storage.setItem('currentAccountId', accountId);
  loginResolve();

  if (IS_EXTENSION) {
    void callHook('onFirstLogin');
  }

  if (isFirstLogin) {
    sendUpdateTokens(onUpdate);
  }

  const account = await fetchStoredAccount(accountId);

  if (!IS_CORE_WALLET) {
    void setupAccountConfigPolling(accountId, account);
  }

  if ('ton' in account) {
    ton.setupPolling(accountId, onUpdate, pickChainTimestamps(newestActivityTimestamps, 'ton'));
  }
  if ('tron' in account) {
    void tron.setupPolling(accountId, onUpdate, pickChainTimestamps(newestActivityTimestamps, 'tron'));
  }
}

function pickChainTimestamps(bySlug: ApiActivityTimestamps, chain: ApiChain) {
  const { slug: nativeSlug } = getChainConfig(chain).nativeToken;
  return Object.entries(bySlug).reduce((newBySlug, [slug, timestamp]) => {
    if (slug === nativeSlug || slug.startsWith(`${chain}-`)) {
      newBySlug[slug] = timestamp;
    }
    return newBySlug;
  }, {} as ApiActivityTimestamps);
}

export function deactivateAllAccounts() {
  setActiveAccountId(undefined);

  if (IS_EXTENSION) {
    void callHook('onFullLogout');
  }
}

export function fetchTonWallet(accountId: string): Promise<ApiTonWallet> {
  return fetchStoredTonWallet(accountId);
}

export function fetchLedgerAccount(accountId: string) {
  return fetchStoredAccount<ApiLedgerAccount>(accountId);
}

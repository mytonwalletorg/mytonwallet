import type {
  ApiActivityTimestamps, ApiChain, ApiLedgerAccount, ApiTonWallet, ApiUpdatingStatus, OnApiUpdate,
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

let onUpdate: OnApiUpdate;
const setUpdatingStatus = createUpdatingStatusManager();

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

  for (const chain of Object.keys(chains) as (keyof typeof chains)[]) {
    if (chain in account) {
      void chains[chain].setupPolling(
        accountId,
        onUpdate,
        setUpdatingStatus.bind(undefined, accountId, chain),
        pickChainTimestamps(newestActivityTimestamps, chain),
      );
    }
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

/**
 * Returns a stateful function that receives updating statuses from multiple chains and merges them together into a
 * single set of consistent 'updatingStatus' events for the UI.
 */
function createUpdatingStatusManager() {
  const updatingStatuses = new Map<string, Set<ApiChain>>();

  return (accountId: string, chain: ApiChain, kind: ApiUpdatingStatus['kind'], isUpdating: boolean) => {
    const key = `${accountId} ${kind}`;
    let chainsBeingUpdated = updatingStatuses.get(key);
    if (!chainsBeingUpdated) {
      chainsBeingUpdated = new Set();
      updatingStatuses.set(key, chainsBeingUpdated);
    }

    const wasAnyUpdating = chainsBeingUpdated.size > 0;

    if (isUpdating) {
      chainsBeingUpdated.add(chain);
      if (!wasAnyUpdating) {
        onUpdate({ type: 'updatingStatus', kind, accountId, isUpdating: true });
      }
    } else {
      chainsBeingUpdated.delete(chain);
      if (chainsBeingUpdated.size === 0 && wasAnyUpdating) {
        onUpdate({ type: 'updatingStatus', kind, accountId, isUpdating: false });
      }
    }
  };
}

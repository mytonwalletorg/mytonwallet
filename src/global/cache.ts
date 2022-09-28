import { addCallback, removeCallback } from '../lib/teact/teactn';

import { GlobalState } from './types';

import { onBeforeUnload, onIdle, throttle } from '../util/schedulers';
import {
  DEBUG, GLOBAL_STATE_CACHE_DISABLED, GLOBAL_STATE_CACHE_KEY, MAIN_ACCOUNT_ID,
} from '../config';
import { isHeavyAnimating } from '../hooks/useHeavyAnimationCheck';
import { pick } from '../util/iteratees';

import { INITIAL_STATE } from './initialState';
import { addActionHandler, getGlobal } from './index';
import { getIsTxIdLocal } from './helpers';

const UPDATE_THROTTLE = 5000;
const TXS_LIMIT = 20;

const updateCacheThrottled = throttle(() => onIdle(updateCache), UPDATE_THROTTLE, false);

let isCaching = false;
let unsubscribeFromBeforeUnload: NoneToVoidFunction | undefined;

export function initCache() {
  if (GLOBAL_STATE_CACHE_DISABLED) {
    return;
  }

  addActionHandler('afterSignIn', () => {
    setupCaching();
  });

  addActionHandler('signOut', () => {
    localStorage.removeItem(GLOBAL_STATE_CACHE_KEY);

    if (!isCaching) {
      return;
    }

    clearCaching();
  });
}

export function loadCache(initialState: GlobalState) {
  return readCache(initialState);
}

function setupCaching() {
  isCaching = true;
  unsubscribeFromBeforeUnload = onBeforeUnload(() => {
    // Allow to manually delete cache
    if (DEBUG && !localStorage.getItem(GLOBAL_STATE_CACHE_KEY)) {
      return;
    }

    updateCache();
  }, true);
  window.addEventListener('blur', updateCache);
  addCallback(updateCacheThrottled);
}

function clearCaching() {
  isCaching = false;
  removeCallback(updateCacheThrottled);
  window.removeEventListener('blur', updateCache);
  if (unsubscribeFromBeforeUnload) {
    unsubscribeFromBeforeUnload();
  }
}

function readCache(initialState: GlobalState): GlobalState {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.time('global-state-cache-read');
  }

  const json = localStorage.getItem(GLOBAL_STATE_CACHE_KEY);
  const cached = json ? JSON.parse(json) as GlobalState : undefined;

  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.timeEnd('global-state-cache-read');
  }

  if (cached) {
    migrateCache(cached, initialState);
  }

  return {
    ...initialState,
    ...cached,
  };
}

function migrateCache(cached: GlobalState, initialState: GlobalState) {
  // Pre-fill settings with defaults
  cached.settings = {
    ...initialState.settings,
    ...cached.settings,
  };

  if (cached.balances?.byAccountId && 'byTicker' in cached.balances.byAccountId[MAIN_ACCOUNT_ID]) {
    cached.balances = undefined;
  }
}

function updateCache() {
  if (GLOBAL_STATE_CACHE_DISABLED) {
    return;
  }

  if (!isCaching || isHeavyAnimating()) {
    return;
  }

  const global = getGlobal();

  const reducedGlobal: GlobalState = {
    ...INITIAL_STATE,
    ...pick(global, [
      'addresses',
      'balances',
      'tokenInfo',
      'settings',
      'isBackupRequired',
      'savedAddresses',
      'currentTokenSlug',
    ]),
    transactions: reduceTransactions(global),
  };

  const json = JSON.stringify(reducedGlobal);
  localStorage.setItem(GLOBAL_STATE_CACHE_KEY, json);
}

function reduceTransactions(global: GlobalState) {
  const { transactions } = global;

  if (!transactions?.orderedTxIds) {
    return undefined;
  }

  const orderedTxIds = transactions.orderedTxIds.filter((id) => !getIsTxIdLocal(id)).slice(0, TXS_LIMIT);
  const byTxId = pick(transactions.byTxId, orderedTxIds);

  return {
    ...INITIAL_STATE.transactions,
    byTxId,
    orderedTxIds,
  };
}

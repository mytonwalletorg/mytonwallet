import { getIsHeavyAnimating, onFullyIdle } from '../lib/teact/teact';
import { addCallback, removeCallback } from '../lib/teact/teactn';

import type { ApiActivity } from '../api/types';
import type {
  AccountState,
  GlobalState,
  LanguageSource,
} from './types';

import {
  DEBUG,
  GLOBAL_STATE_CACHE_DISABLED,
  GLOBAL_STATE_CACHE_KEY,
  IS_CAPACITOR,
  TONCOIN,
} from '../config';
import { getActivityTokenSlugs, getIsActivityPending, getIsTxIdLocal } from '../util/activities';
import { bigintReviver } from '../util/bigint';
import { getTokenInfo } from '../util/chain';
import isEmptyObject from '../util/isEmptyObject';
import { extractKey, filterValues, mapValues, omit, pick, pickTruthy,
} from '../util/iteratees';
import {
  clearPoisoningCache,
  updatePoisoningCacheFromGlobalState,
} from '../util/poisoningHash';
import { onBeforeUnload, throttle } from '../util/schedulers';
import { getIsActiveStakingState } from '../util/staking';
import { IS_ANDROID_APP, USER_AGENT_LANG_CODE } from '../util/windowEnvironment';
import { addActionHandler, getGlobal } from './index';
import { INITIAL_STATE, STATE_VERSION } from './initialState';
import { selectAccountState, selectAccountTokens } from './selectors';

const UPDATE_THROTTLE = IS_CAPACITOR ? 500 : 5000;
const ACTIVITIES_LIMIT = 20;
const ACTIVITY_TOKENS_LIMIT = 30;

const updateCacheThrottled = throttle(() => onFullyIdle(() => updateCache()), UPDATE_THROTTLE, false);
const updateCacheForced = () => updateCache(true);

let isCaching = false;
let unsubscribeFromBeforeUnload: NoneToVoidFunction | undefined;
let preloadedData: Partial<GlobalState> | undefined;

export function initCache() {
  if (GLOBAL_STATE_CACHE_DISABLED) {
    return;
  }

  addActionHandler('afterSignIn', setupCaching);

  addActionHandler('afterSignOut', (global, actions, payload) => {
    clearPoisoningCache();

    if (payload?.shouldReset) {
      preloadedData = pick(global, ['tokenInfo', 'restrictions']);
      clearCaching();
      localStorage.removeItem(GLOBAL_STATE_CACHE_KEY);
    }
  });

  addActionHandler('cancelCaching', clearCaching);
}

function setupCaching() {
  if (isCaching) return;

  isCaching = true;

  addCallback(updateCacheThrottled);
  unsubscribeFromBeforeUnload = onBeforeUnload(updateCacheForced, true);
  window.addEventListener('blur', updateCacheForced);

  updateCacheForced();
}

function clearCaching() {
  if (!isCaching) return;

  window.removeEventListener('blur', updateCacheForced);
  unsubscribeFromBeforeUnload?.();
  removeCallback(updateCacheThrottled);

  isCaching = false;
}

export function loadCache(initialState: GlobalState): GlobalState {
  if (GLOBAL_STATE_CACHE_DISABLED) {
    return initialState;
  }

  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.time('global-state-cache-read');
  }

  const json = localStorage.getItem(GLOBAL_STATE_CACHE_KEY);
  let cached = json ? JSON.parse(json, bigintReviver) as GlobalState : undefined;

  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.timeEnd('global-state-cache-read');
  }

  if (cached) {
    try {
      migrateCache(cached, initialState);
      loadMemoryCache(cached);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);

      cached = undefined;
    }
  }

  const merged = {
    ...initialState,
    ...preloadedData,
    ...cached,
  };

  return normalizeCapacitorLanguageSettings(merged);
}

function normalizeCapacitorLanguageSettings(global: GlobalState): GlobalState {
  if (!IS_CAPACITOR) {
    return global;
  }

  const settings = global.settings;
  const langSource: LanguageSource = settings.langSource === 'user' ? 'user' : 'system';

  return {
    ...global,
    settings: {
      ...settings,
      langCode: !IS_ANDROID_APP && langSource === 'user' ? settings.langCode : USER_AGENT_LANG_CODE,
      langSource,
    },
  };
}

function migrateCache(cached: GlobalState, initialState: GlobalState) {
  // Keep defaults added in the current application version while preserving settings saved by this installation.
  cached.settings = {
    ...initialState.settings,
    ...cached.settings,
  };

  if (cached.stateVersion === STATE_VERSION) {
    return;
  }

  // ION Wallet starts with a clean storage namespace. Future persisted-state migrations belong here;
  // each must advance `stateVersion` to `STATE_VERSION` after transforming the cached data.
  cached.stateVersion = STATE_VERSION;
}

function loadMemoryCache(cached: GlobalState) {
  updatePoisoningCacheFromGlobalState(cached);
}

const getUsedTokenSlugs = (reducedGlobal: GlobalState): string[] => {
  const usedTokenSlugs = new Set<string>(Object.keys(getTokenInfo()));

  if (reducedGlobal.currentAccountId) {
    const currentTokenSlug = reducedGlobal.byAccountId[reducedGlobal.currentAccountId]?.currentTokenSlug;
    if (currentTokenSlug) {
      usedTokenSlugs.add(currentTokenSlug);
    }
  }

  Object.values(reducedGlobal.byAccountId).forEach((state) => {
    const { balances, activities, staking } = state;

    Object.keys(balances?.bySlug ?? {}).forEach((slug) => usedTokenSlugs.add(slug));
    Object.keys(activities?.byId ?? {}).forEach((transactionId) => {
      getActivityTokenSlugs(activities!.byId[transactionId]).forEach((slug) => usedTokenSlugs.add(slug));
    });
    Object.keys(activities?.idsBySlug ?? {}).forEach((slug) => usedTokenSlugs.add(slug));
    Object.keys(staking?.stateById ?? {}).forEach((id) => {
      usedTokenSlugs.add(staking!.stateById![id].tokenSlug);
    });
  });

  return Array.from(usedTokenSlugs);
};

function getAccountTokenSlugs(global: GlobalState, accountId: string) {
  const { currentTokenSlug } = selectAccountState(global, accountId) ?? {};
  const tokenSlugs = extractKey(selectAccountTokens(global, accountId) ?? [], 'slug')
    .slice(0, ACTIVITY_TOKENS_LIMIT);

  if (!tokenSlugs.includes(TONCOIN.slug)) {
    tokenSlugs.push(TONCOIN.slug);
  }

  if (currentTokenSlug && !tokenSlugs.includes(currentTokenSlug)) {
    tokenSlugs.push(currentTokenSlug);
  }

  return tokenSlugs;
}

function updateCache(force?: boolean) {
  if (GLOBAL_STATE_CACHE_DISABLED || !isCaching || (!force && getIsHeavyAnimating())) {
    return;
  }

  const global = getGlobalWithoutTemporaryAccount();

  const accountsById = global.accounts?.byId || {};
  const accountIds = Object.keys(accountsById);
  const reducedGlobal: GlobalState = {
    ...INITIAL_STATE,
    ...pick(global, [
      'authTypes',
      'currentAccountId',
      // The temporary account is correctly removed from the state during the initialization phase
      'currentTemporaryViewAccountId',
      'stateVersion',
      'restrictions',
      'pushNotifications',
      'isFullscreen',
      'isManualLockActive',
      'stakingDefault',
      'currencyRates',
      'accountSelectorViewMode',
    ]),
    accounts: {
      byId: accountsById,
    },
    byAccountId: reduceByAccountId(global),
    settings: {
      ...global.settings,
      byAccountId: pick(global.settings.byAccountId, accountIds),
    },
  };

  const usedTokenSlugs = getUsedTokenSlugs(reducedGlobal);

  reducedGlobal.tokenInfo = {
    bySlug: pickTruthy(global.tokenInfo.bySlug, usedTokenSlugs),
  };

  const json = JSON.stringify(reducedGlobal);
  localStorage.setItem(GLOBAL_STATE_CACHE_KEY, json);
}

function getGlobalWithoutTemporaryAccount(): GlobalState {
  const global = getGlobal();
  const temporaryAccountId = global.currentTemporaryViewAccountId;
  if (!temporaryAccountId) return global;

  const accountsById = global.accounts?.byId;
  if (!accountsById || !(temporaryAccountId in accountsById)) {
    return global;
  }

  const newAccountsById = omit(global.accounts!.byId, [temporaryAccountId]);
  const newByAccountId = omit(global.byAccountId, [temporaryAccountId]);
  const newSettingsByAccountId = omit(global.settings.byAccountId, [temporaryAccountId]);
  const orderedAccountIds = global.settings.orderedAccountIds?.filter((id) => id !== temporaryAccountId);

  return {
    ...global,
    currentTemporaryViewAccountId: undefined,
    accounts: {
      ...global.accounts,
      byId: newAccountsById,
    },
    byAccountId: newByAccountId,
    settings: {
      ...global.settings,
      byAccountId: newSettingsByAccountId,
      orderedAccountIds,
    },
  };
}

function reduceByAccountId(global: GlobalState) {
  return Object.entries(global.byAccountId).reduce((acc, [accountId, state]) => {
    if (!global.accounts?.byId[accountId]) {
      return acc;
    }

    acc[accountId] = pick(state, [
      'isBackupRequired',
      'currentTokenSlug',
      'currentTokenPeriod',
      'savedAddresses',
      'staking',
      'activeContentTab',
      'browserHistory',
      'blacklistedNftAddresses',
      'whitelistedNftAddresses',
      'dappLastOpenedDatesByUrl',
      'dapps',
    ]);

    if (state.nfts?.collectionTabs) {
      acc[accountId].nfts = { collectionTabs: state.nfts.collectionTabs };
    }

    const accountTokenSlugs = getAccountTokenSlugs(global, accountId);
    acc[accountId].balances = reduceAccountBalances(state.balances, accountTokenSlugs);
    acc[accountId].activities = reduceAccountActivities(state.activities, accountTokenSlugs);
    acc[accountId].staking = reduceAccountStaking(state.staking);

    return acc;
  }, {} as GlobalState['byAccountId']);
}

function reduceAccountBalances(balances?: AccountState['balances'], tokenSlugs?: string[]) {
  if (!balances?.bySlug || !tokenSlugs) return balances;

  return {
    ...balances,
    bySlug: pick(balances.bySlug, tokenSlugs),
  };
}

function reduceAccountActivities(activities?: AccountState['activities'], tokenSlugs?: string[]) {
  const {
    idsBySlug, newestActivitiesBySlug, byId, idsMain,
  } = activities || {};
  if (!tokenSlugs || !idsBySlug || !byId || !idsMain) return undefined;

  const reducedIdsMain = pickVisibleActivities(idsMain, byId);
  const reducedIdsBySlug = mapValues(pickTruthy(idsBySlug, tokenSlugs), (ids) => pickVisibleActivities(ids, byId));

  const reducedNewestActivitiesBySlug = newestActivitiesBySlug
    ? pick(newestActivitiesBySlug, tokenSlugs)
    : undefined;

  const reducedIds = Object.values(reducedIdsBySlug).concat(reducedIdsMain).flat();
  const reducedById = pick(byId, reducedIds);

  return {
    byId: reducedById,
    idsMain: reducedIdsMain,
    idsBySlug: reducedIdsBySlug,
    newestActivitiesBySlug: reducedNewestActivitiesBySlug,
  };
}

function reduceAccountStaking(staking?: AccountState['staking']) {
  let { stakingId, stateById } = staking ?? {};

  if (stateById && !isEmptyObject(stateById)) {
    stateById = filterValues(stateById, getIsActiveStakingState);

    if (!stakingId || !(stakingId in stateById)) {
      stakingId = Object.values(stateById)[0]?.id;
    }
  }

  return {
    ...staking,
    stateById,
    stakingId,
  };
}

function pickVisibleActivities(ids: string[], byId: Record<string, ApiActivity>) {
  const result: string[] = [];

  let visibleIdCount = 0;

  ids
    .filter((id) => shouldCacheActivity(id, byId))
    .forEach((id) => {
      if (visibleIdCount === ACTIVITIES_LIMIT) return;

      if (!byId[id].shouldHide) {
        visibleIdCount += 1;
      }

      result.push(id);
    });

  return result;
}

function shouldCacheActivity(id: string, byId: Record<string, ApiActivity>) {
  const activity = byId[id];
  return activity
    && !getIsTxIdLocal(id)
    && !getIsActivityPending(activity);
}

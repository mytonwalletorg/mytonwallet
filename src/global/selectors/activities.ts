import type { ApiActivity, ApiActivityTimestamps, ApiChain } from '../../api/types';
import type { GlobalState } from '../types';

import { getIsActivitySuitableForFetchingTimestamp, getIsTxIdLocal } from '../../util/activities';
import { compact, findLast, mapValues } from '../../util/iteratees';
import { selectAccount, selectAccountState } from './accounts';

export function selectNewestActivityTimestamps(global: GlobalState, accountId: string): ApiActivityTimestamps {
  return mapValues(
    selectAccountState(global, accountId)?.activities?.newestActivitiesBySlug || {},
    ({ timestamp }) => timestamp,
  );
}

export function selectLastMainTxTimestamp(global: GlobalState, accountId: string): number | undefined {
  const activities = selectAccountState(global, accountId)?.activities;
  if (!activities) return undefined;

  const { byId, idsMain = [] } = activities;
  const txId = findLast(idsMain, (id) => getIsActivitySuitableForFetchingTimestamp(byId[id]));
  if (!txId) return undefined;

  return byId[txId].timestamp;
}

export function selectAccountTxTokenSlugs(global: GlobalState, accountId: string, chain: ApiChain) {
  const idsBySlug = selectAccountState(global, accountId)?.activities?.idsBySlug;
  if (!idsBySlug) return undefined;

  return Object.keys(idsBySlug).filter((slug) => slug.startsWith(`${chain}-`));
}

export function selectLocalActivitiesSlow(global: GlobalState, accountId: string) {
  const { byId = {}, localActivityIds = [] } = global.byAccountId[accountId]?.activities ?? {};

  return compact(localActivityIds.map((id) => byId[id]));
}

/** Doesn't include local activities */
export function selectPendingActivitiesSlow(global: GlobalState, accountId: string, chain: ApiChain) {
  const { byId = {}, pendingActivityIds = {} } = global.byAccountId[accountId]?.activities ?? {};
  const ids = pendingActivityIds[chain] ?? [];

  return compact(ids.map((id) => byId[id]));
}

export function selectRecentNonLocalActivitiesSlow(global: GlobalState, accountId: string, maxCount: number) {
  const { byId = {}, idsMain = [] } = global.byAccountId[accountId]?.activities ?? {};
  const result: ApiActivity[] = [];

  for (const id of idsMain) {
    if (result.length >= maxCount) {
      break;
    }
    if (getIsTxIdLocal(id)) {
      continue;
    }
    const activity = byId[id];
    if (activity) {
      result.push(activity);
    }
  }

  return result;
}

export function selectIsFirstTransactionsLoaded(global: GlobalState, accountId: string) {
  const { isFirstTransactionsLoaded } = selectAccountState(global, accountId)?.activities ?? {};
  const { addressByChain } = selectAccount(global, accountId) ?? {};

  if (!isFirstTransactionsLoaded || !addressByChain) {
    return false;
  }

  return Object.keys(addressByChain).every((chain) => isFirstTransactionsLoaded[chain as ApiChain]);
}

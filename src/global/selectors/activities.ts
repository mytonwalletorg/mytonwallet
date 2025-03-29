import type { ApiActivityTimestamps, ApiChain } from '../../api/types';
import type { GlobalState } from '../types';

import { getIsIdSuitableForFetchingTimestamp } from '../../util/activities';
import { findLast, mapValues } from '../../util/iteratees';
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
  const txId = findLast(idsMain, (id) => getIsIdSuitableForFetchingTimestamp(id) && Boolean(byId[id]));
  if (!txId) return undefined;

  return byId[txId].timestamp;
}

export function selectAccountTxTokenSlugs(global: GlobalState, accountId: string, chain: ApiChain) {
  const idsBySlug = selectAccountState(global, accountId)?.activities?.idsBySlug;
  if (!idsBySlug) return undefined;

  return Object.keys(idsBySlug).filter((slug) => slug.startsWith(`${chain}-`));
}

export function selectLocalActivities(global: GlobalState, accountId: string) {
  const accountState = global.byAccountId?.[accountId];

  return accountState?.activities?.localActivities;
}

export function selectIsFirstTransactionsLoaded(global: GlobalState, accountId: string) {
  const { byChain } = selectAccountState(global, accountId) ?? {};
  const { addressByChain } = selectAccount(global, accountId) ?? {};

  if (!byChain || !addressByChain) {
    return false;
  }

  return Object.keys(addressByChain).every((chain) => byChain[chain as ApiChain]?.isFirstTransactionsLoaded);
}

import type { ApiChain, ApiTxTimestamps } from '../../api/types';
import type { GlobalState } from '../types';

import { findLast, mapValues } from '../../util/iteratees';
import { getIsSwapId, getIsTxIdLocal } from '../helpers';
import { selectAccount, selectAccountState } from './accounts';

export function selectNewestTxTimestamps(global: GlobalState, accountId: string): ApiTxTimestamps {
  return mapValues(
    selectAccountState(global, accountId)?.activities?.newestTransactionsBySlug || {},
    ({ timestamp }) => timestamp,
  );
}

export function selectLastTxTimestamps(global: GlobalState, accountId: string): ApiTxTimestamps {
  const txById = selectAccountState(global, accountId)?.activities?.byId ?? {};
  const idsBySlug = selectAccountState(global, accountId)?.activities?.idsBySlug || {};

  return Object.entries(idsBySlug).reduce((result, [slug, ids]) => {
    const txId = findLast(ids, (id) => !getIsTxIdLocal(id) && !getIsSwapId(id));
    if (txId && txId in txById) {
      result[slug] = txById[txId].timestamp;
    }
    return result;
  }, {} as ApiTxTimestamps);
}

export function selectLastMainTxTimestamp(global: GlobalState, accountId: string): number | undefined {
  const activities = selectAccountState(global, accountId)?.activities;
  if (!activities) return undefined;

  const { byId, idsMain = [] } = activities;
  const txId = findLast(idsMain, (id) => !getIsTxIdLocal(id) && !getIsSwapId(id));
  if (!txId) return undefined;

  return byId[txId].timestamp;
}

export function selectAccountTxTokenSlugs(global: GlobalState, accountId: string, chain: ApiChain) {
  const idsBySlug = selectAccountState(global, accountId)?.activities?.idsBySlug;
  if (!idsBySlug) return undefined;

  return Object.keys(idsBySlug).filter((slug) => slug.startsWith(`${chain}-`));
}

export function selectLocalTransactions(global: GlobalState, accountId: string) {
  const accountState = global.byAccountId?.[accountId];

  return accountState?.activities?.localTransactions;
}

export function selectIsFirstTransactionsLoaded(global: GlobalState, accountId: string) {
  const { byChain } = selectAccountState(global, accountId) ?? {};
  const { addressByChain } = selectAccount(global, accountId)!;

  if (!byChain || !addressByChain) {
    return false;
  }

  return Object.keys(addressByChain).every((chain) => byChain[chain as ApiChain]?.isFirstTransactionsLoaded);
}

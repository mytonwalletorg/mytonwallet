import type { ApiActivity } from '../../api/types';
import type { GlobalState } from '../types';

import { getIsTxIdLocal } from '../helpers';
import { selectAccountState } from '../selectors';
import { updateAccountState } from './misc';

export function updateActivity(global: GlobalState, accountId: string, activity: ApiActivity): GlobalState {
  const { activities } = selectAccountState(global, accountId) || {};
  const idsBySlug = activities?.idsBySlug || {};

  const { id, timestamp } = activity;

  const { slug } = activity;
  const isLocal = getIsTxIdLocal(id);
  let newestTransactionsBySlug = activities?.newestTransactionsBySlug || {};

  if (!isLocal) {
    const newestTx = newestTransactionsBySlug[slug];
    if (!newestTx || newestTx.timestamp < timestamp) {
      newestTransactionsBySlug = { ...newestTransactionsBySlug, [slug]: activity };
    }
  }

  let tokenIds = idsBySlug[slug] || [];

  if (!tokenIds.includes(id)) {
    tokenIds = [id].concat(tokenIds);
  }

  return updateAccountState(global, accountId, {
    activities: {
      ...activities,
      byId: { ...activities?.byId, [id]: activity },
      idsBySlug: { ...idsBySlug, [slug]: tokenIds },
      newestTransactionsBySlug,
    },
  });
}

export function removeTransaction(global: GlobalState, accountId: string, txId: string) {
  const { activities } = selectAccountState(global, accountId) || {};
  let { idsBySlug } = activities || {};
  const { [txId]: removedActivity, ...byTxId } = activities?.byId || {};
  const slug = removedActivity?.kind === 'transaction' && removedActivity.slug;

  if (slug && idsBySlug && idsBySlug[slug]) {
    idsBySlug = { ...idsBySlug, [slug]: idsBySlug[slug].filter((x) => x !== txId) };
  }

  return updateAccountState(global, accountId, {
    activities: {
      ...activities,
      byId: byTxId,
      idsBySlug,
    },
  });
}

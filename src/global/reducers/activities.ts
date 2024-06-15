import type { ApiActivity, ApiTransactionActivity } from '../../api/types';
import type { GlobalState } from '../types';

import {
  buildCollectionByKey, groupBy, mapValues, unique,
} from '../../util/iteratees';
import { getIsTxIdLocal } from '../helpers';
import { selectAccountState } from '../selectors';
import { updateAccountState } from './misc';

export function updateActivity(global: GlobalState, accountId: string, activity: ApiActivity): GlobalState {
  const { activities } = selectAccountState(global, accountId) || {};
  const idsBySlug = activities?.idsBySlug || {};

  const { id, timestamp, kind } = activity;

  if (kind === 'swap') {
    const { from, to } = activity;

    let fromTokenIds = idsBySlug[from] || [];
    let toTokenIds = idsBySlug[to] || [];

    if (!fromTokenIds.includes(id)) {
      fromTokenIds = [id].concat(fromTokenIds);
    }
    if (!toTokenIds.includes(id)) {
      toTokenIds = [id].concat(toTokenIds);
    }

    return updateAccountState(global, accountId, {
      activities: {
        ...activities,
        byId: { ...activities?.byId, [id]: activity },
        idsBySlug: { ...idsBySlug, [from]: fromTokenIds, [to]: toTokenIds },
      },
    });
  }

  const { slug } = activity;
  const isLocal = getIsTxIdLocal(id);
  let newestTransactionsBySlug = activities?.newestTransactionsBySlug || {};

  if (!isLocal) {
    const newestTx = newestTransactionsBySlug[slug];
    if (!newestTx || newestTx.timestamp < timestamp || (newestTx.timestamp === timestamp && newestTx.txId < id)) {
      newestTransactionsBySlug = { ...newestTransactionsBySlug, [slug]: activity };
    }
  }

  let tokenTxIds = idsBySlug[slug] || [];

  if (!tokenTxIds.includes(id)) {
    tokenTxIds = [id].concat(tokenTxIds);
  }

  return updateAccountState(global, accountId, {
    activities: {
      ...activities,
      byId: { ...activities?.byId, [id]: activity },
      idsBySlug: { ...idsBySlug, [slug]: tokenTxIds },
      newestTransactionsBySlug,
    },
  });
}

export function addNewActivities(global: GlobalState, accountId: string, newActivities: ApiActivity[]) {
  let { activities } = selectAccountState(global, accountId) || {};

  const newById = buildCollectionByKey(newActivities, 'id');

  const newIdsBySlug = buildActivityIdsBySlug(newActivities);
  const replacedIdsBySlug = mapValues(newIdsBySlug, (newIds, slug) => {
    const currentActivityIds = activities?.idsBySlug?.[slug];

    return currentActivityIds ? unique(newIds.concat(currentActivityIds)) : newIds;
  });

  const newTxs = newActivities.filter(({ kind }) => kind === 'transaction') as ApiTransactionActivity[];
  const newTxsBySlug = groupBy(newTxs, 'slug');
  const newNewestTxsBySlug = mapValues(newTxsBySlug, (txs) => txs[0]);

  activities = {
    ...activities,
    byId: { ...activities?.byId, ...newById },
    idsBySlug: { ...activities?.idsBySlug, ...replacedIdsBySlug },
    newestTransactionsBySlug: { ...activities?.newestTransactionsBySlug, ...newNewestTxsBySlug },
  };

  return updateAccountState(global, accountId, { activities });
}

function buildActivityIdsBySlug(activities: ApiActivity[]) {
  return activities.reduce<Record<string, string[]>>((acc, activity) => {
    const { id } = activity;

    if ('slug' in activity) {
      if (!acc[activity.slug]) {
        acc[activity.slug] = [id];
      } else {
        acc[activity.slug].push(id);
      }
    }

    if ('from' in activity) {
      if (!acc[activity.from]) {
        acc[activity.from] = [id];
      } else {
        acc[activity.from].push(id);
      }
    }

    if ('to' in activity) {
      if (!acc[activity.to]) {
        acc[activity.to] = [id];
      } else {
        acc[activity.to].push(id);
      }
    }

    return acc;
  }, {});
}

export function assignRemoteTxId(
  global: GlobalState,
  accountId: string,
  txId: string,
  newTxId: string,
  newAmount: bigint,
  shouldHide?: boolean,
) {
  const { activities } = selectAccountState(global, accountId) || {};
  const { byId, idsBySlug } = activities || { byId: {}, idsBySlug: {} };
  const replacedActivity: ApiActivity | undefined = byId[txId];

  if (!replacedActivity || replacedActivity.kind !== 'transaction') return global;

  const slug = replacedActivity.slug;
  const updatedIdsBySlug = { ...idsBySlug };

  if (slug in updatedIdsBySlug) {
    const indexOfTxId = updatedIdsBySlug[slug].indexOf(txId);
    if (indexOfTxId === -1) return global;

    updatedIdsBySlug[slug] = [
      ...updatedIdsBySlug[slug].slice(0, indexOfTxId),
      newTxId,
      ...updatedIdsBySlug[slug].slice(indexOfTxId + 1),
    ];
  }

  const updatedByTxId = {
    ...byId,
    [newTxId]: {
      ...replacedActivity,
      id: newTxId,
      txId: newTxId,
      amount: newAmount,
      shouldHide,
    },
  };

  delete updatedByTxId[txId];

  return updateAccountState(global, accountId, {
    activities: {
      ...activities,
      byId: updatedByTxId,
      idsBySlug: updatedIdsBySlug,
    },
  });
}

export function addLocalTransaction(global: GlobalState, accountId: string, transaction: ApiTransactionActivity) {
  const { activities } = selectAccountState(global, accountId) || {};
  const localTransactions = (activities?.localTransactions ?? []).concat(transaction);

  return updateAccountState(global, accountId, {
    activities: {
      ...activities,
      byId: activities?.byId ?? {},
      localTransactions,
    },
  });
}

export function removeLocalTransaction(global: GlobalState, accountId: string, txId: string) {
  const { activities } = selectAccountState(global, accountId) || {};
  const localTransactions = (activities?.localTransactions ?? []).filter(({ id }) => id !== txId);

  return updateAccountState(global, accountId, {
    activities: {
      ...activities,
      byId: activities?.byId ?? {},
      localTransactions,
    },
  });
}

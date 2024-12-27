import type {
  ApiActivity, ApiChain, ApiTransaction, ApiTransactionActivity,
} from '../../api/types';
import type { GlobalState } from '../types';

import { compareActivities } from '../../util/compareActivities';
import {
  buildCollectionByKey, extractKey, groupBy, mapValues, unique,
} from '../../util/iteratees';
import { getIsTxIdLocal } from '../helpers';
import { selectAccountState } from '../selectors';
import { updateAccountState } from './misc';

export function updateActivity(global: GlobalState, accountId: string, activity: ApiActivity): GlobalState {
  const { activities } = selectAccountState(global, accountId) || {};
  const idsBySlug = activities?.idsBySlug || {};

  const { id, timestamp, kind } = activity;

  const idsMain = [id].concat(activities?.idsMain ?? []);

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
        idsMain,
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
      idsMain,
      byId: { ...activities?.byId, [id]: activity },
      idsBySlug: { ...idsBySlug, [slug]: tokenTxIds },
      newestTransactionsBySlug,
    },
  });
}

export function addNewActivities(global: GlobalState, accountId: string, newActivities: ApiActivity[]) {
  let { activities } = selectAccountState(global, accountId) || {};

  const newById = buildCollectionByKey(newActivities, 'id');
  const byId = { ...activities?.byId, ...newById };

  const newIdsMain = extractKey(newActivities, 'id');
  const idsMain = unique(newIdsMain.concat(activities?.idsMain ?? []));

  // Activities from different blockchains arrive separately, which causes the order to be disrupted
  idsMain.sort((a, b) => compareActivities(byId[a], byId[b]));

  const newIdsBySlug = buildActivityIdsBySlug(newActivities);
  const replacedIdsBySlug = mapValues(newIdsBySlug, (newIds, slug) => {
    const currentActivityIds = activities?.idsBySlug?.[slug];

    return currentActivityIds ? unique(newIds.concat(currentActivityIds)) : newIds;
  });

  const newTxs = newActivities.filter(({ kind }) => kind === 'transaction') as ApiTransactionActivity[];
  const newNewestTxsBySlug: Record<string, ApiTransaction> = { ...activities?.newestTransactionsBySlug };

  // The transaction that replaced the local one may be newer
  for (const [slug, txs] of Object.entries(groupBy(newTxs, 'slug'))) {
    const newTx = txs[0];
    if (!(slug in newNewestTxsBySlug) || newTx.timestamp > newNewestTxsBySlug[slug].timestamp) {
      newNewestTxsBySlug[slug] = newTx;
    }
  }

  activities = {
    ...activities,
    idsMain,
    byId,
    idsBySlug: { ...activities?.idsBySlug, ...replacedIdsBySlug },
    newestTransactionsBySlug: newNewestTxsBySlug,
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

export function replaceLocalTransaction(
  global: GlobalState,
  accountId: string,
  localTxId: string,
  activity: ApiTransactionActivity,
) {
  const { activities } = selectAccountState(global, accountId) || {};
  const { byId, idsBySlug } = activities || { byId: {}, idsBySlug: {} };
  const replacedActivity: ApiActivity | undefined = byId[localTxId];

  if (!replacedActivity || replacedActivity.kind !== 'transaction') return global;

  const {
    slug, amount, timestamp, txId, shouldHide, fee,
  } = activity;
  const updatedIdsBySlug = { ...idsBySlug };
  let { idsMain = [], newestTransactionsBySlug = {} } = activities ?? {};

  if (slug in updatedIdsBySlug) {
    const indexOfTxId = updatedIdsBySlug[slug].indexOf(localTxId);
    if (indexOfTxId === -1) return global;

    updatedIdsBySlug[slug] = [
      ...updatedIdsBySlug[slug].slice(0, indexOfTxId),
      txId,
      ...updatedIdsBySlug[slug].slice(indexOfTxId + 1),
    ];

    const indexOfTxIdMain = idsMain.indexOf(localTxId);
    if (indexOfTxIdMain === -1) return global;

    idsMain = [
      ...idsMain.slice(0, indexOfTxIdMain),
      txId,
      ...idsMain.slice(indexOfTxIdMain + 1),
    ];
  }

  const updatedByTxId = {
    ...byId,
    [txId]: {
      ...replacedActivity,
      id: txId,
      txId,
      amount,
      shouldHide,
      timestamp,
      fee,
    },
  };

  delete updatedByTxId[localTxId];

  const newestTransaction = newestTransactionsBySlug[slug];

  if (!newestTransaction || timestamp > newestTransaction.timestamp) {
    newestTransactionsBySlug = {
      ...newestTransactionsBySlug,
      [slug]: activity,
    };
  }

  return updateAccountState(global, accountId, {
    activities: {
      ...activities,
      idsMain,
      byId: updatedByTxId,
      idsBySlug: updatedIdsBySlug,
      newestTransactionsBySlug,
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

export function setIsFirstActivitiesLoadedTrue(global: GlobalState, accountId: string, chain: ApiChain) {
  const { byChain } = selectAccountState(global, accountId) ?? {};

  if (byChain && byChain[chain]?.isFirstTransactionsLoaded) {
    return global;
  }

  return updateAccountState(global, accountId, {
    byChain: {
      ...byChain,
      [chain]: {
        ...byChain?.[chain],
        isFirstTransactionsLoaded: true,
      },
    },
  });
}

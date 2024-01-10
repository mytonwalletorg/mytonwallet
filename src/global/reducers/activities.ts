import type { ApiActivity, ApiTransactionActivity } from '../../api/types';
import type { GlobalState } from '../types';

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

export function assignRemoteTxId(global: GlobalState, accountId: string, txId: string, newTxId: string) {
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
    [newTxId]: { ...replacedActivity, id: newTxId, txId: newTxId },
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

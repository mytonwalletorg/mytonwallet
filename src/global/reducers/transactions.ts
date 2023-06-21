import type { ApiTransaction } from '../../api/types';
import type { GlobalState } from '../types';

import { getIsTxIdLocal } from '../helpers';
import { selectAccountState } from '../selectors';
import { updateAccountState } from './misc';

export function updateTransaction(global: GlobalState, accountId: string, transaction: ApiTransaction): GlobalState {
  const { transactions } = selectAccountState(global, accountId) || {};

  const { txId, timestamp, slug } = transaction;
  const isLocal = getIsTxIdLocal(txId);
  let newestTransactionsBySlug = transactions?.newestTransactionsBySlug || {};

  if (!isLocal) {
    const newestTx = newestTransactionsBySlug[slug];
    if (!newestTx || newestTx.timestamp < timestamp) {
      newestTransactionsBySlug = { ...newestTransactionsBySlug, [slug]: transaction };
    }
  }

  const txIdsBySlug = transactions?.txIdsBySlug || {};
  let tokenTxIds = txIdsBySlug[slug] || [];

  if (!tokenTxIds.includes(txId)) {
    tokenTxIds = [txId].concat(tokenTxIds);
  }

  return updateAccountState(global, accountId, {
    transactions: {
      ...transactions,
      byTxId: { ...transactions?.byTxId, [txId]: transaction },
      txIdsBySlug: { ...txIdsBySlug, [slug]: tokenTxIds },
      newestTransactionsBySlug,
    },
  });
}

export function removeTransaction(global: GlobalState, accountId: string, txId: string) {
  const { transactions } = selectAccountState(global, accountId) || {};
  let { txIdsBySlug } = transactions || {};
  const { [txId]: removedTransaction, ...byTxId } = transactions?.byTxId || {};
  const slug = removedTransaction?.slug;

  if (slug && txIdsBySlug && txIdsBySlug[slug]) {
    txIdsBySlug = { ...txIdsBySlug, [slug]: txIdsBySlug[slug].filter((x) => x !== txId) };
  }

  return updateAccountState(global, accountId, {
    transactions: {
      ...transactions,
      byTxId,
      txIdsBySlug,
    },
  });
}

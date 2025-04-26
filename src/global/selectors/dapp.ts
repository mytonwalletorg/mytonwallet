import type { ApiDappTransfer } from '../../api/types';
import type { GlobalState } from '../types';

import { TONCOIN } from '../../config';
import memoize from '../../util/memoize';
import { isNftTransferPayload, isTokenTransferPayload } from '../../util/ton/transfer';

const selectCurrentDappTransferTotalsMemoized = memoize((
  transactions: ApiDappTransfer[] | undefined,
) => {
  const amountsBySlug: Record<string, bigint> = {};
  const addSlugAmount = (tokenSlug: string, amount: bigint) => {
    amountsBySlug[tokenSlug] = (amountsBySlug[tokenSlug] ?? 0n) + amount;
  };

  let isScam = false;
  let isDangerous = false;
  let nftCount = 0;

  for (const transaction of transactions ?? []) {
    if (transaction.isScam) isScam = true;
    if (transaction.isDangerous) isDangerous = true;

    addSlugAmount(TONCOIN.slug, transaction.amount + transaction.networkFee);

    if (isTokenTransferPayload(transaction.payload)) {
      addSlugAmount(transaction.payload.slug, transaction.payload.amount);
    } else if (isNftTransferPayload(transaction.payload)) {
      nftCount++;
    }
  }

  return {
    amountsBySlug,
    isScam,
    isDangerous,
    nftCount,
  };
});

export function selectCurrentDappTransferTotals(global: GlobalState) {
  const { transactions } = global.currentDappTransfer;
  return selectCurrentDappTransferTotalsMemoized(transactions);
}

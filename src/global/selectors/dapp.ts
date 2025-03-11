import type { ApiDappTransfer } from '../../api/types';
import type { GlobalState } from '../types';

import { TONCOIN } from '../../config';
import memoize from '../../util/memoize';
import { isTokenTransferPayload } from '../../util/ton/transfer';

const selectCurrentDappTransferTotalsMemoized = memoize((
  transactions: ApiDappTransfer[] | undefined,
) => {
  const amountsBySlug: Record<string, bigint> = {};
  const addSlugAmount = (tokenSlug: string, amount: bigint) => {
    amountsBySlug[tokenSlug] = (amountsBySlug[tokenSlug] ?? 0n) + amount;
  };

  let isScam = false;
  let isDangerous = false;
  let fullFee = 0n;
  let received = 0n;

  for (const transaction of transactions ?? []) {
    if (transaction.isScam) isScam = true;
    if (transaction.isDangerous) isDangerous = true;
    fullFee += transaction.fullFee;
    received += transaction.received;

    addSlugAmount(TONCOIN.slug, transaction.displayedAmount);

    if (isTokenTransferPayload(transaction.payload)) {
      addSlugAmount(transaction.payload.slug, transaction.payload.amount);
    }
  }

  return {
    amountsBySlug,
    isScam,
    isDangerous,
    fullFee, // In TON
    received, // In TON
  };
});

export function selectCurrentDappTransferTotals(global: GlobalState) {
  const { transactions } = global.currentDappTransfer;
  return selectCurrentDappTransferTotalsMemoized(transactions);
}

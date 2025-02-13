import type { ApiDappTransfer, ApiTokenWithPrice } from '../../api/types';
import type { ExtendedDappTransfer, GlobalState } from '../types';

import { TONCOIN } from '../../config';
import { Big } from '../../lib/big.js';
import { bigintDivideToNumber } from '../../util/bigint';
import { toDecimal } from '../../util/decimals';
import memoize from '../../util/memoize';
import {
  getDappTransferActualToAddress,
  isTokenTransferPayload,
  isTransferPayloadDangerous,
} from '../../util/ton/transfer';

const selectExtendedDappTransactionsMemoized = memoize((
  transactions: ApiDappTransfer[] | undefined,
  totalNetworkFee: bigint | undefined,
) => {
  if (!transactions) {
    return transactions;
  }

  const feePerTransfer = totalNetworkFee && bigintDivideToNumber(totalNetworkFee, transactions.length || 1);

  return transactions.map<ExtendedDappTransfer>((transfer) => ({
    ...transfer,
    fee: feePerTransfer,
    realToAddress: getDappTransferActualToAddress(transfer),
    isDangerous: isTransferPayloadDangerous(transfer.payload),
  }));
});

export function selectCurrentDappTransferExtendedTransactions(global: GlobalState) {
  const { transactions, fee } = global.currentDappTransfer;
  return selectExtendedDappTransactionsMemoized(transactions, fee);
}

const selectCurrentDappTransferTotalAmountsMemoized = memoize((
  transactions: ApiDappTransfer[] | undefined,
  totalNetworkFee: bigint | undefined,
  tokensBySlug: Record<string, ApiTokenWithPrice>,
) => {
  const amountBySlug: Record<string, Big> = {
    [TONCOIN.slug]: Big(toDecimal(totalNetworkFee ?? 0n, TONCOIN.decimals)),
  };

  for (const { payload, amount } of transactions ?? []) {
    const amountDecimal = toDecimal(amount, TONCOIN.decimals);
    amountBySlug[TONCOIN.slug] = amountBySlug[TONCOIN.slug].add(amountDecimal);

    if (isTokenTransferPayload(payload)) {
      const { slug: tokenSlug, amount: tokenAmount } = payload;
      const token = tokensBySlug[tokenSlug];

      if (token) {
        const tokenAmountDecimal = toDecimal(tokenAmount, token.decimals);
        amountBySlug[tokenSlug] = (amountBySlug[tokenSlug] ?? Big(0)).add(tokenAmountDecimal);
      }
    }
  }

  const totalCost = Object.entries(amountBySlug).reduce((sum, [tokenSlug, amount]) => {
    const price = tokensBySlug[tokenSlug]?.quote.price ?? 0;
    return sum + amount.toNumber() * price;
  }, 0);

  return {
    bySlug: amountBySlug,
    cost: totalCost,
  };
});

export function selectCurrentDappTransferTotalAmounts(global: GlobalState) {
  const { transactions, fee } = global.currentDappTransfer;
  return selectCurrentDappTransferTotalAmountsMemoized(transactions, fee, global.tokenInfo.bySlug);
}

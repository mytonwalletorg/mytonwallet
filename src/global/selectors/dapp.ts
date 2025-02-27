import type { ApiDappTransfer, ApiEmulationResult, ApiTokenWithPrice } from '../../api/types';
import type { ExtendedDappTransfer, GlobalState } from '../types';

import { TONCOIN } from '../../config';
import { Big } from '../../lib/big.js';
import { bigintDivideToNumber } from '../../util/bigint';
import { toDecimal } from '../../util/decimals';
import memoize from '../../util/memoize';
import {
  doesTransactionAmountActAsFee,
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
    networkFee: feePerTransfer,
    realToAddress: getDappTransferActualToAddress(transfer),
    isDangerous: isTransferPayloadDangerous(transfer.payload),
  }));
});

export function selectCurrentDappTransferExtendedTransactions(global: GlobalState) {
  const { transactions, networkFee } = global.currentDappTransfer;
  return selectExtendedDappTransactionsMemoized(transactions, networkFee);
}

const selectCurrentDappTransferTotalsMemoized = memoize((
  transactions: ApiDappTransfer[] | undefined,
  totalNetworkFee: bigint | undefined,
  emulationResult: Pick<ApiEmulationResult,
  'totalNetworkFee' | 'totalRealFee' | 'totalReceived' | 'totalChange'
  > | undefined,
  tokensBySlug: Record<string, ApiTokenWithPrice>,
) => {
  const amountsBySlug: Record<string, Big> = {};
  const addSlugAmount = (tokenSlug: string, amount: string) => {
    amountsBySlug[tokenSlug] = (amountsBySlug[tokenSlug] ?? Big(0)).add(amount);
  };

  let fullFee: bigint;
  let realFee: bigint | undefined;
  let received: bigint | undefined;
  let change: bigint | undefined;

  if (emulationResult) {
    fullFee = emulationResult.totalNetworkFee ?? 0n;
    realFee = emulationResult.totalRealFee;
    received = emulationResult.totalReceived;
    change = emulationResult.totalChange;
  } else {
    fullFee = totalNetworkFee ?? 0n;
  }

  for (const { payload, amount } of transactions ?? []) {
    if (doesTransactionAmountActAsFee(payload)) {
      fullFee += amount;
    } else {
      addSlugAmount(TONCOIN.slug, toDecimal(amount, TONCOIN.decimals));
    }

    if (isTokenTransferPayload(payload)) {
      const { slug: tokenSlug, amount: tokenAmount } = payload;
      const token = tokensBySlug[tokenSlug];

      if (token) {
        addSlugAmount(tokenSlug, toDecimal(tokenAmount, token.decimals));
      }
    }
  }

  const amountCost = Object.entries(amountsBySlug).reduce((sum, [tokenSlug, amount]) => {
    const price = tokensBySlug[tokenSlug]?.quote.price ?? 0;
    return sum + amount.toNumber() * price;
  }, 0);

  return {
    amountsBySlug,
    /** The fiat cost of everything except the fee */
    amountCost,
    // All the fees are in TON
    fullFee,
    /** Undefined means that it's unknown, so the full fee and the received amount should be show in the UI instead */
    realFee,
    received,
    change,
  };
});

export function selectCurrentDappTransferTotals(global: GlobalState) {
  const { transactions, networkFee, emulationResult } = global.currentDappTransfer;
  return selectCurrentDappTransferTotalsMemoized(transactions, networkFee, emulationResult, global.tokenInfo.bySlug);
}

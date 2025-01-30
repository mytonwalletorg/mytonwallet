import type { ApiCheckTransactionDraftResult } from '../../api/chains/ton/types';
import type { GlobalState } from '../types';

import { pick } from '../../util/iteratees';
import { INITIAL_STATE } from '../initialState';
import { selectCurrentTransferMaxAmount } from '../selectors';

export function updateCurrentTransferByCheckResult(global: GlobalState, result: ApiCheckTransactionDraftResult) {
  const nextGlobal = updateCurrentTransfer(global, {
    toAddressName: result.addressName,
    ...pick(result, ['fee', 'realFee', 'isScam', 'isMemoRequired', 'diesel']),
  });
  return preserveMaxTransferAmount(global, nextGlobal);
}

export function updateCurrentTransfer(global: GlobalState, update: Partial<GlobalState['currentTransfer']>) {
  return {
    ...global,
    currentTransfer: {
      ...global.currentTransfer,
      ...update,
    },
  };
}

export function clearCurrentTransfer(global: GlobalState) {
  return {
    ...global,
    currentTransfer: INITIAL_STATE.currentTransfer,
  };
}

/**
 * Preserves the maximum transfer amount, if it was selected.
 * Returns a modified version of `nextGlobal`.
 */
export function preserveMaxTransferAmount(prevGlobal: GlobalState, nextGlobal: GlobalState) {
  const previousMaxAmount = selectCurrentTransferMaxAmount(prevGlobal);
  const wasMaxAmountSelected = previousMaxAmount && prevGlobal.currentTransfer.amount === previousMaxAmount;
  if (!wasMaxAmountSelected) {
    return nextGlobal;
  }
  const nextMaxAmount = selectCurrentTransferMaxAmount(nextGlobal);
  return updateCurrentTransfer(nextGlobal, { amount: nextMaxAmount });
}

export function updateCurrentTransferLoading(global: GlobalState, isLoading: boolean): GlobalState {
  return {
    ...global,
    currentTransfer: {
      ...global.currentTransfer,
      isLoading,
    },
  };
}

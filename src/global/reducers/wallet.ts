import type { ApiCheckTransactionDraftResult } from '../../api/chains/ton/types';
import type { GlobalState } from '../types';

import { pick } from '../../util/iteratees';
import { INITIAL_STATE } from '../initialState';
import { selectAccountState, selectCurrentAccountState, selectCurrentTransferMaxAmount } from '../selectors';
import { updateAccountState, updateCurrentAccountId, updateCurrentAccountState } from './misc';
import { clearCurrentSwap } from './swap';

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

export function updateCurrentSignature(global: GlobalState, update: Partial<GlobalState['currentSignature']>) {
  return {
    ...global,
    currentSignature: {
      ...global.currentSignature,
      ...update,
    },
  } as GlobalState;
}

export function clearCurrentSignature(global: GlobalState) {
  return {
    ...global,
    currentSignature: undefined,
  };
}

export function updateActivitiesIsLoading(global: GlobalState, isLoading: boolean) {
  const { activities } = selectCurrentAccountState(global) || {};

  return updateCurrentAccountState(global, {
    activities: {
      ...activities || { byId: {} },
      isLoading,
    },
  });
}

export function updateActivitiesIsHistoryEndReached(global: GlobalState, isReached: boolean, slug?: string) {
  const { activities } = selectCurrentAccountState(global) || {};

  if (slug) {
    const bySlug = activities?.isHistoryEndReachedBySlug ?? {};

    return updateCurrentAccountState(global, {
      activities: {
        ...activities || { byId: {} },
        isHistoryEndReachedBySlug: {
          ...bySlug,
          [slug]: isReached,
        },
      },
    });
  }

  return updateCurrentAccountState(global, {
    activities: {
      ...activities || { byId: {} },
      isMainHistoryEndReached: isReached,
    },
  });
}

export function updateActivitiesIsLoadingByAccount(global: GlobalState, accountId: string, isLoading: boolean) {
  const { activities } = selectAccountState(global, accountId) || {};

  return updateAccountState(global, accountId, {
    activities: {
      ...activities || { byId: {} },
      isLoading,
    },
  });
}

/**
 * Preserves the maximum transfer amount, if it was selected.
 * Returns a modified version of `nextGlobal`.
 */
function preserveMaxTransferAmount(prevGlobal: GlobalState, nextGlobal: GlobalState) {
  const previousMaxAmount = selectCurrentTransferMaxAmount(prevGlobal);
  const wasMaxAmountSelected = prevGlobal.currentTransfer.amount === previousMaxAmount;
  if (!wasMaxAmountSelected) {
    return nextGlobal;
  }
  const nextMaxAmount = selectCurrentTransferMaxAmount(nextGlobal);
  return updateCurrentTransfer(nextGlobal, { amount: nextMaxAmount });
}

export function switchAccountAndClearGlobal(global: GlobalState, accountId: string) {
  let newGlobal = updateCurrentAccountId(global, accountId);
  newGlobal = clearCurrentTransfer(newGlobal);

  return clearCurrentSwap(newGlobal);
}

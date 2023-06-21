import { TransferState } from '../types';
import type { GlobalState } from '../types';

import { selectAccountState, selectCurrentAccountState } from '../selectors';
import { updateAccountState, updateCurrentAccountState } from './misc';

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
    currentTransfer: {
      state: TransferState.None,
    },
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

export function updateTransactionsIsLoading(global: GlobalState, isLoading: boolean) {
  const { transactions } = selectCurrentAccountState(global) || {};

  return updateCurrentAccountState(global, {
    transactions: {
      ...transactions || { byTxId: {} },
      isLoading,
    },
  });
}

export function updateTransactionsIsLoadingByAccount(global: GlobalState, accountId: string, isLoading: boolean) {
  const { transactions } = selectAccountState(global, accountId) || {};

  return updateAccountState(global, accountId, {
    transactions: {
      ...transactions || { byTxId: {} },
      isLoading,
    },
  });
}

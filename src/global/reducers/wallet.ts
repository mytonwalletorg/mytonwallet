import { BackupWallet, GlobalState, TransferState } from '../types';
import { selectCurrentAccountState } from '../selectors';
import { updateCurrentAccountsState, updateCurrentAccountState } from './misc';

export function updateCurrentTransfer(global: GlobalState, update: Partial<GlobalState['currentTransfer']>) {
  return {
    ...global,
    currentTransfer: {
      ...global.currentTransfer,
      ...update,
    },
  };
}

export function removeLocalTransaction(global: GlobalState, localTxId: string) {
  const { transactions } = selectCurrentAccountState(global) || {};
  const { [localTxId]: removedTransaction, ...byTxId } = transactions?.byTxId || {};

  return updateCurrentAccountState(global, {
    transactions: {
      ...transactions,
      byTxId,
      orderedTxIds: transactions?.orderedTxIds?.filter((txId) => txId !== localTxId),
    },
  });
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

export function updateBackupWalletModal(global: GlobalState, update: Partial<BackupWallet>) {
  const { backupWallet } = selectCurrentAccountState(global) || {};

  return updateCurrentAccountsState(global, {
    backupWallet: {
      ...backupWallet,
      ...update,
    },
  });
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

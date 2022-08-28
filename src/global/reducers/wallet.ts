import { GlobalState, TransferState } from '../types';

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

export function updateBackupWalletModal(global: GlobalState, update: Partial<GlobalState['backupWallet']>) {
  return {
    ...global,
    backupWallet: {
      ...global.backupWallet,
      ...update,
    },
  } as GlobalState;
}

export function updateTransactionsIsLoading(global: GlobalState, isLoading: boolean) {
  return {
    ...global,
    transactions: {
      ...global.transactions,
      byTxId: global.transactions?.byTxId || {},
      isLoading,
    },
  };
}

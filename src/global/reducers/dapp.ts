import type { GlobalState } from '../types';
import { TransferState } from '../types';

export function updateDappConnectRequest(global: GlobalState, update: Partial<GlobalState['dappConnectRequest']>) {
  return {
    ...global,
    dappConnectRequest: {
      ...global.dappConnectRequest,
      ...update,
    },
  } as GlobalState;
}

export function clearDappConnectRequestError(global: GlobalState) {
  return {
    ...global,
    dappConnectRequest: {
      ...global.dappConnectRequest,
      error: undefined,
    },
  } as GlobalState;
}

export function clearDappConnectRequest(global: GlobalState) {
  return {
    ...global,
    dappConnectRequest: undefined,
  } as GlobalState;
}

export function updateCurrentDappTransfer(global: GlobalState, update: Partial<GlobalState['currentDappTransfer']>) {
  return {
    ...global,
    currentDappTransfer: {
      ...global.currentDappTransfer,
      ...update,
    },
  };
}

export function clearCurrentDappTransfer(global: GlobalState) {
  return {
    ...global,
    currentDappTransfer: {
      state: TransferState.None,
    },
  };
}

export function updateConnectedDapps(global: GlobalState, update: Partial<GlobalState['settings']>) {
  return {
    ...global,
    settings: {
      ...global.settings,
      dapps: update.dapps ?? [],
    },
  } as GlobalState;
}

export function clearConnectedDapps(global: GlobalState) {
  return {
    ...global,
    settings: {
      ...global.settings,
      dapps: [],
    },
  } as GlobalState;
}

export function removeConnectedDapp(global: GlobalState, origin: string) {
  return {
    ...global,
    settings: {
      ...global.settings,
      dapps: global.settings.dapps.filter((dapp) => dapp.origin !== origin),
    },
  } as GlobalState;
}

import type { AccountState, GlobalState } from '../types';
import { SignDataState, TransferState } from '../types';

import { selectCurrentAccountState } from '../selectors';
import { updateCurrentAccountState } from './misc';

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

export function clearCurrentDappTransfer(global: GlobalState): GlobalState {
  return {
    ...global,
    currentDappTransfer: {
      state: TransferState.None,
    },
  };
}

export function updateCurrentDappSignData(global: GlobalState, update: Partial<GlobalState['currentDappSignData']>) {
  return {
    ...global,
    currentDappSignData: {
      ...global.currentDappSignData,
      ...update,
    },
  };
}

export function clearCurrentDappSignData(global: GlobalState): GlobalState {
  return {
    ...global,
    currentDappSignData: {
      state: SignDataState.None,
    },
  };
}

export function updateConnectedDapps(global: GlobalState, update: AccountState['dapps']) {
  return updateCurrentAccountState(global, { dapps: update });
}

export function clearConnectedDapps(global: GlobalState) {
  return updateCurrentAccountState(global, { dapps: undefined, dappLastOpenedDatesByOrigin: undefined });
}

export function removeConnectedDapp(global: GlobalState, origin: string) {
  const { dapps: connectedDapps, dappLastOpenedDatesByOrigin } = selectCurrentAccountState(global) || {};
  if (dappLastOpenedDatesByOrigin) delete dappLastOpenedDatesByOrigin[origin];
  return updateCurrentAccountState(global, {
    dapps: connectedDapps!.filter((d) => d.origin !== origin),
    dappLastOpenedDatesByOrigin,
  });
}

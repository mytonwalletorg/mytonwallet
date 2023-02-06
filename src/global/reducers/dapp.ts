import { GlobalState } from '../types';

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

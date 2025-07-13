import type { ApiDappConnectionType } from '../../../api/types';
import type { GlobalState } from '../../types';
import { DappConnectState, SignDataState, TransferState } from '../../types';

import { ANIMATION_END_DELAY, IS_CAPACITOR } from '../../../config';
import { areDeepEqual } from '../../../util/areDeepEqual';
import { getDoesUsePinPad } from '../../../util/biometrics';
import { getDappConnectionUniqueId } from '../../../util/getDappConnectionUniqueId';
import { vibrateOnSuccess } from '../../../util/haptics';
import { callActionInMain } from '../../../util/multitab';
import { pause, waitFor } from '../../../util/schedulers';
import { IS_DELEGATED_BOTTOM_SHEET } from '../../../util/windowEnvironment';
import { callApi } from '../../../api';
import {
  ApiHardwareBlindSigningNotEnabled,
  ApiUnsupportedVersionError,
  ApiUserRejectsError,
} from '../../../api/errors';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  clearConnectedDapps,
  clearCurrentDappSignData,
  clearCurrentDappTransfer,
  clearDappConnectRequest,
  clearIsPinAccepted,
  removeConnectedDapp,
  setIsPinAccepted,
  updateConnectedDapps,
  updateCurrentDappSignData,
  updateCurrentDappTransfer,
  updateDappConnectRequest,
} from '../../reducers';
import { selectIsHardwareAccount } from '../../selectors';
import { switchAccount } from './auth';

import { getIsPortrait } from '../../../hooks/useDeviceScreen';

import { CLOSE_DURATION, CLOSE_DURATION_PORTRAIT } from '../../../components/ui/Modal';

const GET_DAPPS_PAUSE = 250;

addActionHandler('submitDappConnectRequestConfirm', async (global, actions, { password, accountId }) => {
  const {
    promiseId, permissions,
  } = global.dappConnectRequest!;

  if (permissions?.isPasswordRequired && (!password || !(await callApi('verifyPassword', password)))) {
    global = getGlobal();
    global = updateDappConnectRequest(global, { error: 'Wrong password, please try again.' });
    setGlobal(global);

    return;
  }

  if (getDoesUsePinPad()) {
    global = getGlobal();
    global = setIsPinAccepted(global);
    setGlobal(global);
  }

  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('submitDappConnectRequestConfirm', { password, accountId });

    return;
  }

  void vibrateOnSuccess();
  actions.switchAccount({ accountId });
  await callApi('confirmDappRequestConnect', promiseId!, {
    accountId,
    password,
  });

  global = getGlobal();
  if (IS_CAPACITOR) {
    global = clearIsPinAccepted(global);
  }
  global = clearDappConnectRequest(global);
  setGlobal(global);

  await pause(GET_DAPPS_PAUSE);
  actions.getDapps();
});

addActionHandler(
  'submitDappConnectRequestConfirmHardware',
  async (global, actions, { accountId: connectAccountId }) => {
    const { proof } = global.dappConnectRequest!;

    global = getGlobal();
    global = updateDappConnectRequest(global, {
      error: undefined,
      state: DappConnectState.ConfirmHardware,
    });
    setGlobal(global);

    const ledgerApi = await import('../../../util/ledger');

    try {
      const signature = await ledgerApi.signLedgerProof(connectAccountId, proof!);
      if (IS_DELEGATED_BOTTOM_SHEET) {
        callActionInMain('submitDappConnectHardware', { accountId: connectAccountId, signature });

        return;
      }

      actions.submitDappConnectHardware({ accountId: connectAccountId, signature });
    } catch (err) {
      // todo: Distinguish user cancellation from other errors. For example, when the proof payload is too long (>256 bytes).
      // todo: Show a clear message for dapp developers in this case. Requirements: payload size ≤ 128 bytes, domain ≤ 128 bytes, payload + domain ≤ 222 bytes.
      setGlobal(updateDappConnectRequest(getGlobal(), {
        error: 'Canceled by the user',
      }));
    }
  },
);

addActionHandler('submitDappConnectHardware', async (global, actions, { accountId, signature }) => {
  const { promiseId } = global.dappConnectRequest!;

  actions.switchAccount({ accountId });
  await callApi('confirmDappRequestConnect', promiseId!, { accountId, signature });

  global = getGlobal();
  global = clearDappConnectRequest(global);
  setGlobal(global);

  await pause(GET_DAPPS_PAUSE);
  actions.getDapps();
});

addActionHandler('cancelDappConnectRequestConfirm', (global) => {
  cancelDappOperation(
    (global) => global.dappConnectRequest,
    () => callActionInMain('cancelDappConnectRequestConfirm'),
    clearDappConnectRequest,
  );
});

addActionHandler('setDappConnectRequestState', (global, actions, { state }) => {
  setGlobal(updateDappConnectRequest(global, { state }));
});

addActionHandler('cancelDappTransfer', (global) => {
  cancelDappOperation(
    (global) => global.currentDappTransfer,
    () => callActionInMain('cancelDappTransfer'),
    clearCurrentDappTransfer,
  );
});

function cancelDappOperation(
  getState: (global: GlobalState) => { promiseId?: string } | undefined,
  callInMain: NoneToVoidFunction,
  clearState: (global: GlobalState) => GlobalState,
) {
  let global = getGlobal();
  const { promiseId } = getState(global) ?? {};

  if (IS_DELEGATED_BOTTOM_SHEET) {
    callInMain();
  } else if (promiseId) {
    void callApi('cancelDappRequest', promiseId, 'Canceled by the user');
  }

  if (getDoesUsePinPad()) {
    global = clearIsPinAccepted(global);
  }
  global = clearState(global);
  setGlobal(global);
}

addActionHandler('submitDappTransferPassword', async (global, actions, { password }) => {
  await submitDappOperationPassword(
    password,
    (global) => global.currentDappTransfer,
    () => callActionInMain('submitDappTransferPassword', { password }),
    updateCurrentDappTransfer,
    clearCurrentDappTransfer,
  );
});

async function submitDappOperationPassword(
  password: string,
  getState: (global: GlobalState) => { promiseId?: string },
  callInMain: NoneToVoidFunction,
  updateState: (global: GlobalState, update: { isLoading?: true; error?: string }) => GlobalState,
  clearState: (global: GlobalState) => GlobalState,
) {
  let global = getGlobal();
  const { promiseId } = getState(global);

  if (!promiseId) {
    return;
  }

  if (!(await callApi('verifyPassword', password))) {
    global = getGlobal();
    global = updateState(global, {
      error: 'Wrong password, please try again.',
    });
    setGlobal(global);

    return;
  }

  if (getDoesUsePinPad()) {
    global = getGlobal();
    global = setIsPinAccepted(global);
    setGlobal(global);
  }

  if (IS_DELEGATED_BOTTOM_SHEET) {
    callInMain();
    return;
  }

  global = getGlobal();
  global = updateState(global, {
    isLoading: true,
    error: undefined,
  });
  setGlobal(global);

  await vibrateOnSuccess(true);
  void callApi('confirmDappRequest', promiseId, password);

  global = getGlobal();
  if (IS_CAPACITOR) {
    global = clearIsPinAccepted(global);
  }
  global = clearState(global);
  setGlobal(global);
}

addActionHandler('submitDappTransferHardware', async (global, actions) => {
  const { promiseId, transactions, vestingAddress } = global.currentDappTransfer;

  if (!promiseId) {
    return;
  }

  global = getGlobal();
  global = updateCurrentDappTransfer(global, {
    isLoading: true,
    error: undefined,
    state: TransferState.ConfirmHardware,
  });
  setGlobal(global);

  const accountId = global.currentAccountId!;
  const ledgerApi = await import('../../../util/ledger');

  try {
    const signedMessages = await ledgerApi.signLedgerTransactions(accountId, transactions!, {
      isTonConnect: true,
      vestingAddress,
    });

    if (IS_DELEGATED_BOTTOM_SHEET) {
      callActionInMain('submitDappTransferHardware2', { signedMessages });

      return;
    }

    actions.submitDappTransferHardware2({ signedMessages });
  } catch (err) {
    if (err instanceof ApiHardwareBlindSigningNotEnabled) {
      setGlobal(updateCurrentDappTransfer(getGlobal(), {
        isLoading: false,
        error: '$hardware_blind_sign_not_enabled',
      }));
      return;
    } else if (err instanceof ApiUnsupportedVersionError) {
      actions.showError({
        error: '$ledger_unsupported_ton_connect',
      });
      void callApi('cancelDappRequest', promiseId, err.message);
    } else if (err instanceof ApiUserRejectsError) {
      setGlobal(updateCurrentDappTransfer(getGlobal(), {
        isLoading: false,
        error: 'Canceled by the user',
      }));
      return;
    } else {
      void callApi('cancelDappRequest', promiseId, 'Unknown error.');
    }

    global = getGlobal();
    global = clearCurrentDappTransfer(global);
    setGlobal(global);
  }
});

addActionHandler('submitDappTransferHardware2', (global, actions, { signedMessages }) => {
  const { promiseId } = global.currentDappTransfer;

  if (!promiseId) {
    return;
  }

  void callApi('confirmDappRequest', promiseId, signedMessages);

  global = getGlobal();
  global = clearCurrentDappTransfer(global);
  setGlobal(global);
});

addActionHandler('submitDappSignDataPassword', async (global, actions, { password }) => {
  await submitDappOperationPassword(
    password,
    (global) => global.currentDappSignData,
    () => callActionInMain('submitDappSignDataPassword', { password }),
    updateCurrentDappSignData,
    clearCurrentDappSignData,
  );
});

addActionHandler('getDapps', async (global, actions) => {
  const { currentAccountId } = global;

  let result = await callApi('getDapps', currentAccountId!);

  if (!result) {
    return;
  }

  // Check for broken dapps without URL
  const brokenDapp = result.find(({ url }) => !url);
  if (brokenDapp) {
    actions.deleteDapp({ url: brokenDapp.url, uniqueId: getDappConnectionUniqueId(brokenDapp) });
    result = result.filter(({ url }) => url);
  }

  global = getGlobal();
  global = updateConnectedDapps(global, result);
  setGlobal(global);
});

addActionHandler('deleteAllDapps', (global) => {
  const { currentAccountId } = global;

  void callApi('deleteAllDapps', currentAccountId!);

  global = getGlobal();
  global = clearConnectedDapps(global);
  setGlobal(global);
});

addActionHandler('deleteDapp', (global, actions, { url, uniqueId }) => {
  const { currentAccountId } = global;

  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('deleteDapp', { url, uniqueId });
  } else {
    void callApi('deleteDapp', currentAccountId!, url, uniqueId);
  }

  global = getGlobal();
  global = removeConnectedDapp(global, url);
  setGlobal(global);
});

addActionHandler('cancelDappSignData', (global) => {
  cancelDappOperation(
    (global) => global.currentDappSignData,
    () => callActionInMain('cancelDappSignData'),
    clearCurrentDappSignData,
  );
});

addActionHandler('apiUpdateDappConnect', async (global, actions, {
  accountId, dapp, permissions, promiseId, proof,
}) => {
  // We only need to apply changes in NBS when Dapp Connect Modal is already open
  if (IS_DELEGATED_BOTTOM_SHEET) {
    if (!(await waitFor(() => Boolean(getGlobal().dappConnectRequest), 300, 5))) {
      return;
    }

    global = getGlobal();
  }

  global = updateDappConnectRequest(global, {
    state: DappConnectState.Info,
    promiseId,
    accountId,
    dapp,
    permissions: {
      isAddressRequired: permissions.address,
      isPasswordRequired: permissions.proof,
    },
    proof,
  });
  setGlobal(global);

  actions.addSiteToBrowserHistory({ url: dapp.url });
});

addActionHandler('apiUpdateDappSendTransaction', async (global, actions, payload) => {
  const { promiseId, transactions, emulation, dapp, vestingAddress } = payload;

  await apiUpdateDappOperation(
    payload,
    (global) => global.currentDappTransfer,
    actions.closeDappTransfer,
    (global) => global.currentDappTransfer.state !== TransferState.None,
    clearCurrentDappTransfer,
    (global) => updateCurrentDappTransfer(global, {
      state: selectIsHardwareAccount(global) && transactions.length > 1
        ? TransferState.WarningHardware
        : TransferState.Initial,
      promiseId,
      transactions,
      emulation,
      dapp,
      vestingAddress,
    }),
  );
});

addActionHandler('apiUpdateDappSignData', async (global, actions, payload) => {
  const { promiseId, dapp, payloadToSign } = payload;

  await apiUpdateDappOperation(
    payload,
    (global) => global.currentDappSignData,
    actions.closeDappSignData,
    (global) => global.currentDappSignData.state !== SignDataState.None,
    clearCurrentDappSignData,
    (global) => updateCurrentDappSignData(global, {
      state: SignDataState.Initial,
      promiseId,
      dapp,
      payloadToSign,
    }),
  );
});

async function apiUpdateDappOperation(
  payload: { accountId: string },
  getState: (global: GlobalState) => { promiseId?: string },
  close: NoneToVoidFunction,
  isStateActive: (global: GlobalState) => boolean,
  clearState: (global: GlobalState) => GlobalState,
  updateState: (global: GlobalState) => GlobalState,
) {
  let global = getGlobal();

  const { accountId } = payload;
  const { promiseId: currentPromiseId } = getState(global);

  await switchAccount(global, accountId);

  if (currentPromiseId && !IS_DELEGATED_BOTTOM_SHEET) {
    close();
    const closeDuration = getIsPortrait() ? CLOSE_DURATION_PORTRAIT : CLOSE_DURATION;
    await pause(closeDuration + ANIMATION_END_DELAY);
  }

  // We only need to apply changes in NBS when dapp operation modal is already open
  if (IS_DELEGATED_BOTTOM_SHEET) {
    if (!(await waitFor(() => isStateActive(getGlobal()), 300, 5))) {
      return;
    }
  }

  global = getGlobal();
  global = clearState(global);
  global = updateState(global);
  setGlobal(global);
}

addActionHandler('apiUpdateDappLoading', async (global, actions, { connectionType, isSse, accountId }) => {
  // We only need to apply changes in NBS when Dapp Connect Modal is already open
  if (IS_DELEGATED_BOTTOM_SHEET) {
    if (!(await waitFor(() => isAnyDappModalActive(getGlobal(), connectionType), 300, 5))) {
      return;
    }

    global = getGlobal();
  }

  if (!IS_DELEGATED_BOTTOM_SHEET && accountId) {
    actions.switchAccount({ accountId });
  }

  if (connectionType === 'connect') {
    global = updateDappConnectRequest(global, {
      state: DappConnectState.Info,
      isSse,
    });
  } else if (connectionType === 'sendTransaction') {
    global = updateCurrentDappTransfer(global, {
      state: TransferState.Initial,
      isSse,
    });
  } else if (connectionType === 'signData') {
    global = updateCurrentDappSignData(global, {
      state: SignDataState.Initial,
      isSse,
    });
  }
  setGlobal(global);
});

addActionHandler('apiUpdateDappCloseLoading', async (global, actions, { connectionType }) => {
  // We only need to apply changes in NBS when Dapp Modal is already open
  if (IS_DELEGATED_BOTTOM_SHEET) {
    if (!(await waitFor(() => isAnyDappModalActive(getGlobal(), connectionType), 300, 5))) {
      return;
    }

    global = getGlobal();
  }

  // But clear the state if a skeleton is displayed in the Modal
  if (connectionType === 'connect' && global.dappConnectRequest?.state === DappConnectState.Info) {
    global = clearDappConnectRequest(global);
  } else if (connectionType === 'sendTransaction' && global.currentDappTransfer.state === TransferState.Initial) {
    global = clearCurrentDappTransfer(global);
  } else if (connectionType === 'signData' && global.currentDappSignData.state === SignDataState.Initial) {
    global = clearCurrentDappSignData(global);
  }
  setGlobal(global);
});

addActionHandler('loadExploreSites', async (global, _, { isLandscape }) => {
  const exploreData = await callApi('loadExploreSites', { isLandscape });
  global = getGlobal();
  if (areDeepEqual(exploreData, global.exploreData)) {
    return;
  }

  global = { ...global, exploreData };
  setGlobal(global);
});

function isAnyDappModalActive(global: GlobalState, connectionType: ApiDappConnectionType) {
  return (connectionType === 'connect' && !!global.dappConnectRequest)
    || (connectionType === 'sendTransaction' && global.currentDappTransfer.state !== TransferState.None)
    || (connectionType === 'signData' && global.currentDappSignData.state !== SignDataState.None);
}

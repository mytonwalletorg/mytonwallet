import type { ApiDappConnectionType } from '../../../api/types';
import type { GlobalState } from '../../types';
import { DappConnectState, SignDataState, TransferState } from '../../types';

import { ANIMATION_END_DELAY } from '../../../config';
import { areDeepEqual } from '../../../util/areDeepEqual';
import { getDoesUsePinPad } from '../../../util/biometrics';
import { vibrateOnSuccess } from '../../../util/haptics';
import { callActionInMain, callApiInMain } from '../../../util/multitab';
import { pause, waitFor } from '../../../util/schedulers';
import { IS_DELEGATED_BOTTOM_SHEET } from '../../../util/windowEnvironment';
import { callApi } from '../../../api';
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

addActionHandler('submitDappConnectRequestConfirm', async (global, actions, { password = '', accountId }) => {
  const {
    promiseId, permissions, proof,
  } = global.dappConnectRequest!;
  const isHardware = selectIsHardwareAccount(global);

  if (permissions?.isPasswordRequired && !isHardware && !(await callApi('verifyPassword', password))) {
    global = getGlobal();
    global = updateDappConnectRequest(global, { error: 'Wrong password, please try again.' });
    setGlobal(global);

    return;
  }

  if (!isHardware && getDoesUsePinPad()) {
    global = getGlobal();
    global = setIsPinAccepted(global);
    setGlobal(global);
  }

  global = getGlobal();
  global = updateDappConnectRequest(global, {
    error: undefined,
    ...(isHardware && { state: DappConnectState.ConfirmHardware }),
  });
  setGlobal(global);

  let proofSignature: string | undefined;
  if (proof) {
    proofSignature = await callApi('signTonProof', accountId, proof, password);

    if (!proofSignature) {
      global = getGlobal();
      if (getDoesUsePinPad()) {
        global = clearIsPinAccepted(global);
      }
      global = updateDappConnectRequest(global, {
        // todo: Distinguish user cancellation from other errors. For example, when the proof payload is too long (>256 bytes).
        // todo: Show a clear message for dapp developers in this case. Requirements: payload size ≤ 128 bytes, domain ≤ 128 bytes, payload + domain ≤ 222 bytes.
        error: 'Canceled by the user',
      });
      setGlobal(global);
      return;
    }
  }

  if (!isHardware) {
    void vibrateOnSuccess();
  }
  actions.switchAccount({ accountId });
  // It's important to call the API methods including promiseId in the main window, because the Bottom Sheet window
  // knows nothing about that promiseId.
  await callApiInMain('confirmDappRequestConnect', promiseId!, {
    accountId,
    proofSignature,
  });

  global = getGlobal();
  global = clearDappConnectRequest(global);
  setGlobal(global);

  await pause(GET_DAPPS_PAUSE);
  actions.getDapps();
});

addActionHandler('cancelDappConnectRequestConfirm', (global) => {
  cancelDappOperation(
    (global) => global.dappConnectRequest,
    clearDappConnectRequest,
  );
});

addActionHandler('setDappConnectRequestState', (global, actions, { state }) => {
  setGlobal(updateDappConnectRequest(global, { state }));
});

addActionHandler('cancelDappTransfer', (global) => {
  cancelDappOperation(
    (global) => global.currentDappTransfer,
    clearCurrentDappTransfer,
  );
});

function cancelDappOperation(
  getState: (global: GlobalState) => { promiseId?: string } | undefined,
  clearState: (global: GlobalState) => GlobalState,
) {
  let global = getGlobal();
  const { promiseId } = getState(global) ?? {};

  if (promiseId) {
    void callApiInMain('cancelDappRequest', promiseId, 'Canceled by the user');
  }

  if (getDoesUsePinPad()) {
    global = clearIsPinAccepted(global);
  }
  global = clearState(global);
  setGlobal(global);
}

addActionHandler('submitDappTransfer', async (global, actions, { password = '' } = {}) => {
  await submitDappOperation(
    password,
    (global) => global.currentDappTransfer,
    updateCurrentDappTransfer,
    clearCurrentDappTransfer,
  );
});

async function submitDappOperation(
  password: string,
  getState: (global: GlobalState) => { promiseId?: string },
  updateState: (global: GlobalState, update: { isLoading?: true; error?: string }) => GlobalState,
  clearState: (global: GlobalState) => GlobalState,
) {
  let global = getGlobal();
  const { promiseId } = getState(global);
  const isHardware = selectIsHardwareAccount(global);

  if (!promiseId) {
    return;
  }

  if (!isHardware && !(await callApi('verifyPassword', password))) {
    global = getGlobal();
    global = updateState(global, {
      error: 'Wrong password, please try again.',
    });
    setGlobal(global);

    return;
  }

  if (!isHardware && getDoesUsePinPad()) {
    global = getGlobal();
    global = setIsPinAccepted(global);
    setGlobal(global);
  }

  global = getGlobal();
  global = updateState(global, {
    isLoading: true,
    error: undefined,
    ...(isHardware && { state: TransferState.ConfirmHardware }),
  });
  setGlobal(global);

  // todo: Use the same code for both account types
  if (isHardware) {
    const { transactions, validUntil, vestingAddress } = global.currentDappTransfer;
    const accountId = global.currentAccountId!;
    const signedMessages = (await callApi('signTransactions', accountId, transactions!, {
      validUntil,
      vestingAddress,
    }))!;
    if ('error' in signedMessages) {
      // todo: Transform the error code to an error message
      const error = signedMessages.error;
      setGlobal(updateCurrentDappTransfer(getGlobal(), {
        isLoading: false,
        error,
      }));
      return;
    } else {
      void callApiInMain('confirmDappRequest', promiseId, signedMessages);
    }
  } else {
    await vibrateOnSuccess(true);
    void callApiInMain('confirmDappRequest', promiseId, password);
  }

  global = getGlobal();
  global = clearState(global);
  setGlobal(global);
}

addActionHandler('submitDappSignData', async (global, actions, { password = '' } = {}) => {
  await submitDappOperation(
    password,
    (global) => global.currentDappSignData,
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
    actions.deleteDapp({ url: brokenDapp.url });
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

addActionHandler('deleteDapp', (global, actions, { url }) => {
  const { currentAccountId } = global;

  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('deleteDapp', { url });
  } else {
    void callApi('deleteDapp', currentAccountId!, url);
  }

  global = getGlobal();
  global = removeConnectedDapp(global, url);
  setGlobal(global);
});

addActionHandler('cancelDappSignData', (global) => {
  cancelDappOperation(
    (global) => global.currentDappSignData,
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
  const { promiseId, transactions, emulation, dapp, validUntil, vestingAddress } = payload;

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
      validUntil,
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

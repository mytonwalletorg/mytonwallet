import { DappConnectState, TransferState } from '../../types';

import { ANIMATION_END_DELAY, IS_CAPACITOR } from '../../../config';
import { areDeepEqual } from '../../../util/areDeepEqual';
import { vibrateOnSuccess } from '../../../util/capacitor';
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
  clearCurrentDappTransfer,
  clearDappConnectRequest,
  clearIsPinAccepted,
  removeConnectedDapp,
  setIsPinAccepted,
  updateConnectedDapps,
  updateCurrentAccountId,
  updateCurrentDappTransfer,
  updateDappConnectRequest,
} from '../../reducers';
import { selectIsHardwareAccount, selectNewestTxTimestamps } from '../../selectors';

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

  if (IS_CAPACITOR) {
    global = getGlobal();
    global = setIsPinAccepted(global);
    setGlobal(global);
  }

  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('submitDappConnectRequestConfirm', { password, accountId });

    return;
  }

  if (IS_CAPACITOR) {
    void vibrateOnSuccess();
  }

  actions.switchAccount({ accountId });
  await callApi('confirmDappRequestConnect', promiseId!, {
    accountId,
    password,
  });

  global = getGlobal();
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
      const signature = await ledgerApi.signLedgerProof(connectAccountId!, proof!);
      if (IS_DELEGATED_BOTTOM_SHEET) {
        callActionInMain('submitDappConnectHardware', { accountId: connectAccountId, signature });

        return;
      }

      actions.submitDappConnectHardware({ accountId: connectAccountId, signature });
    } catch (err) {
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
  const { promiseId } = global.dappConnectRequest || {};
  if (!promiseId) {
    return;
  }

  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('cancelDappConnectRequestConfirm');
  } else {
    void callApi('cancelDappRequest', promiseId, 'Canceled by the user');
  }

  if (IS_CAPACITOR) {
    global = clearIsPinAccepted(global);
  }
  global = clearDappConnectRequest(global);
  setGlobal(global);
});

addActionHandler('setDappConnectRequestState', (global, actions, { state }) => {
  setGlobal(updateDappConnectRequest(global, { state }));
});

addActionHandler('cancelDappTransfer', (global) => {
  const { promiseId } = global.currentDappTransfer;

  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('cancelDappTransfer');
  } else if (promiseId) {
    void callApi('cancelDappRequest', promiseId, 'Canceled by the user');
  }

  if (IS_CAPACITOR) {
    global = clearIsPinAccepted(global);
  }
  global = clearCurrentDappTransfer(global);
  setGlobal(global);
});

addActionHandler('closeDappTransfer', (global) => {
  global = updateCurrentDappTransfer(global, { state: TransferState.None });
  setGlobal(global);
});

addActionHandler('submitDappTransferPassword', async (global, actions, { password }) => {
  const { promiseId } = global.currentDappTransfer;

  if (!promiseId) {
    return;
  }

  if (!(await callApi('verifyPassword', password))) {
    global = getGlobal();
    global = updateCurrentDappTransfer(global, {
      error: 'Wrong password, please try again.',
    });
    setGlobal(global);

    return;
  }

  if (IS_CAPACITOR) {
    global = getGlobal();
    global = setIsPinAccepted(global);
    setGlobal(global);
  }

  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('submitDappTransferPassword', { password });

    return;
  }

  global = getGlobal();
  global = updateCurrentDappTransfer(global, {
    isLoading: true,
    error: undefined,
  });
  setGlobal(global);

  if (IS_CAPACITOR) {
    await vibrateOnSuccess(true);
  }

  void callApi('confirmDappRequest', promiseId, password);

  global = getGlobal();
  global = clearCurrentDappTransfer(global);
  setGlobal(global);
});

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

addActionHandler('getDapps', async (global, actions) => {
  const { currentAccountId } = global;

  let result = await callApi('getDapps', currentAccountId!);

  if (!result) {
    return;
  }

  // Check for broken dapps without origin
  const brokenDapp = result.find(({ origin }) => !origin);
  if (brokenDapp) {
    actions.deleteDapp({ origin: brokenDapp.origin });
    result = result.filter(({ origin }) => origin);
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

addActionHandler('deleteDapp', (global, actions, { origin }) => {
  const { currentAccountId } = global;

  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('deleteDapp', { origin });
  } else {
    void callApi('deleteDapp', currentAccountId!, origin);
  }

  global = getGlobal();
  global = removeConnectedDapp(global, origin);
  setGlobal(global);
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

addActionHandler('apiUpdateDappSendTransaction', async (global, actions, {
  promiseId,
  transactions,
  fee,
  accountId,
  dapp,
  vestingAddress,
}) => {
  const { currentAccountId, currentDappTransfer: { promiseId: currentPromiseId } } = global;
  if (currentAccountId !== accountId) {
    const nextNewestTxTimestamps = selectNewestTxTimestamps(global, accountId);
    await callApi('activateAccount', accountId, nextNewestTxTimestamps);
    global = getGlobal();
    setGlobal(updateCurrentAccountId(global, accountId));
  }

  if (currentPromiseId && !IS_DELEGATED_BOTTOM_SHEET) {
    actions.closeDappTransfer();
    const closeDuration = getIsPortrait() ? CLOSE_DURATION_PORTRAIT : CLOSE_DURATION;
    await pause(closeDuration + ANIMATION_END_DELAY);
  }

  // We only need to apply changes in NBS when Dapp Transaction Modal is already open
  if (IS_DELEGATED_BOTTOM_SHEET) {
    if (!(await waitFor(() => getGlobal().currentDappTransfer.state !== TransferState.None, 300, 5))) {
      return;
    }

    global = getGlobal();
  }

  const state = selectIsHardwareAccount(global) && transactions.length > 1
    ? TransferState.WarningHardware
    : TransferState.Initial;

  global = getGlobal();
  global = clearCurrentDappTransfer(global);
  global = updateCurrentDappTransfer(global, {
    state,
    promiseId,
    transactions,
    fee,
    dapp,
    vestingAddress,
  });
  setGlobal(global);
});

addActionHandler('apiUpdateDappLoading', async (global, actions, { connectionType, isSse, accountId }) => {
  // We only need to apply changes in NBS when Dapp Connect Modal is already open
  if (IS_DELEGATED_BOTTOM_SHEET) {
    if (!(await waitFor(() => {
      global = getGlobal();
      return (connectionType === 'connect' && !!global.dappConnectRequest)
        || (connectionType === 'sendTransaction' && global.currentDappTransfer.state !== TransferState.None);
    }, 300, 5))) {
      return;
    }

    global = getGlobal();
  }

  if (!IS_DELEGATED_BOTTOM_SHEET && accountId && accountId !== global.currentAccountId) {
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
  }
  setGlobal(global);
});

addActionHandler('apiUpdateDappCloseLoading', async (global) => {
  // We only need to apply changes in NBS when Dapp Modal is already open
  if (IS_DELEGATED_BOTTOM_SHEET) {
    if (!(await waitFor(() => {
      global = getGlobal();
      return (Boolean(global.dappConnectRequest) || global.currentDappTransfer.state !== TransferState.None);
    }, 300, 5))) {
      return;
    }

    global = getGlobal();
  }

  // But clear the state if a skeleton is displayed in the Modal
  if (global.dappConnectRequest?.state === DappConnectState.Info) {
    global = clearDappConnectRequest(global);
  } else if (global.currentDappTransfer.state === TransferState.Initial) {
    global = clearCurrentDappTransfer(global);
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

import { DappConnectState, TransferState } from '../../types';

import { IS_CAPACITOR } from '../../../config';
import { vibrateOnSuccess } from '../../../util/capacitor';
import { pause } from '../../../util/schedulers';
import { IS_DELEGATED_BOTTOM_SHEET } from '../../../util/windowEnvironment';
import { callApi } from '../../../api';
import { ApiUserRejectsError } from '../../../api/errors';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  clearConnectedDapps,
  clearCurrentDappTransfer,
  clearDappConnectRequest,
  clearIsPinAccepted,
  removeConnectedDapp,
  setIsPinAccepted,
  updateConnectedDapps,
  updateCurrentDappTransfer,
  updateDappConnectRequest,
} from '../../reducers';
import { selectAccount, selectIsHardwareAccount, selectNewestTxIds } from '../../selectors';

import { callActionInMain } from '../../../hooks/useDelegatedBottomSheet';

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
  } else if (IS_CAPACITOR) {
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

  const { currentAccountId } = global;

  await pause(GET_DAPPS_PAUSE);
  const result = await callApi('getDapps', currentAccountId!);

  if (!result) {
    return;
  }

  global = getGlobal();
  global = updateConnectedDapps(global, { dapps: result });
  setGlobal(global);
});

addActionHandler(
  'submitDappConnectRequestConfirmHardware',
  async (global, actions, { accountId: connectAccountId }) => {
    const {
      accountId, promiseId, proof,
    } = global.dappConnectRequest!;

    global = getGlobal();
    global = updateDappConnectRequest(global, {
      error: undefined,
      state: DappConnectState.ConfirmHardware,
    });
    setGlobal(global);

    const ledgerApi = await import('../../../util/ledger');

    try {
      const signature = await ledgerApi.signLedgerProof(accountId!, proof!);
      actions.switchAccount({ accountId: connectAccountId });
      await callApi('confirmDappRequestConnect', promiseId!, {
        accountId: connectAccountId,
        signature,
      });
    } catch (err) {
      setGlobal(updateDappConnectRequest(getGlobal(), {
        error: 'Canceled by the user',
      }));
      return;
    }

    global = getGlobal();
    global = clearDappConnectRequest(global);
    setGlobal(global);

    const { currentAccountId } = global;

    await pause(GET_DAPPS_PAUSE);
    const result = await callApi('getDapps', currentAccountId!);

    if (!result) {
      return;
    }

    global = getGlobal();
    global = updateConnectedDapps(global, { dapps: result });
    setGlobal(global);
  },
);

addActionHandler('cancelDappConnectRequestConfirm', (global) => {
  const { promiseId } = global.dappConnectRequest || {};

  if (IS_CAPACITOR) {
    global = clearIsPinAccepted(global);
    setGlobal(global);
  }

  if (!promiseId) {
    return;
  }

  void callApi('cancelDappRequest', promiseId!, 'Canceled by the user');

  global = getGlobal();
  global = clearDappConnectRequest(global);
  setGlobal(global);
});

addActionHandler('setDappConnectRequestState', (global, actions, { state }) => {
  setGlobal(updateDappConnectRequest(global, { state }));
});

addActionHandler('cancelDappTransfer', (global) => {
  const { promiseId } = global.currentDappTransfer;

  if (IS_CAPACITOR) {
    global = clearIsPinAccepted(global);
    setGlobal(global);
  }

  if (promiseId) {
    void callApi('cancelDappRequest', promiseId, 'Canceled by the user');
  }

  global = clearCurrentDappTransfer(getGlobal());
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

  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('submitDappTransferPassword', { password });

    return;
  }

  global = getGlobal();
  if (IS_CAPACITOR) {
    global = setIsPinAccepted(global);
  }
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

addActionHandler('submitDappTransferHardware', async (global) => {
  const { promiseId, transactions } = global.currentDappTransfer;

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
    const signedMessages = await ledgerApi.signLedgerTransactions(accountId, transactions!);
    void callApi('confirmDappRequest', promiseId, signedMessages);
  } catch (err) {
    if (err instanceof ApiUserRejectsError) {
      setGlobal(updateCurrentDappTransfer(getGlobal(), {
        isLoading: false,
        error: 'Canceled by the user',
      }));
      return;
    } else {
      void callApi('cancelDappRequest', promiseId, 'Unknown error.');
    }
  }

  global = getGlobal();
  global = clearCurrentDappTransfer(global);
  setGlobal(global);
});

addActionHandler('getDapps', async (global) => {
  const { currentAccountId } = global;

  const result = await callApi('getDapps', currentAccountId!);

  if (!result) {
    return;
  }

  global = getGlobal();
  global = updateConnectedDapps(global, { dapps: result });
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

  void callApi('deleteDapp', currentAccountId!, origin);

  global = getGlobal();
  global = removeConnectedDapp(global, origin);
  setGlobal(global);
});

addActionHandler('apiUpdateDappConnect', (global, actions, {
  accountId, dapp, permissions, promiseId, proof,
}) => {
  const { isHardware } = selectAccount(global, accountId)!;

  global = updateDappConnectRequest(global, {
    state: DappConnectState.Info,
    promiseId,
    accountId,
    dapp,
    permissions: {
      isAddressRequired: permissions.address,
      isPasswordRequired: permissions.proof && !isHardware,
    },
    proof,
  });
  setGlobal(global);
});

addActionHandler('apiUpdateDappSendTransaction', async (global, actions, {
  promiseId,
  transactions,
  fee,
  accountId,
  dapp,
}) => {
  const { currentAccountId } = global;
  if (currentAccountId !== accountId) {
    const newestTxIds = selectNewestTxIds(global, accountId);
    await callApi('activateAccount', accountId, newestTxIds);
    global = getGlobal();
    setGlobal({
      ...global,
      currentAccountId: accountId,
    });
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
  });
  setGlobal(global);
});

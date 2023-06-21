import { TransferState } from '../../types';

import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  clearDappConnectRequestError, updateCurrentDappTransfer,
} from '../../reducers';
import { selectAccount } from '../../selectors';

addActionHandler('clearDappConnectRequestError', (global) => {
  global = clearDappConnectRequestError(global);
  setGlobal(global);
});

addActionHandler('showDappTransaction', (global, actions, payload) => {
  const { transactionIdx } = payload;

  global = updateCurrentDappTransfer(global, {
    state: TransferState.Confirm,
    viewTransactionOnIdx: transactionIdx,
  });
  setGlobal(global);
});

addActionHandler('setDappTransferScreen', (global, actions, payload) => {
  const { state } = payload;

  global = updateCurrentDappTransfer(global, { state });
  setGlobal(global);
});

addActionHandler('submitDappTransferConfirm', (global, actions) => {
  const accountId = global.currentAccountId!;
  const account = selectAccount(global, accountId)!;

  if (account.isHardware) {
    actions.resetHardwareWalletConnect();
    global = updateCurrentDappTransfer(getGlobal(), { state: TransferState.ConnectHardware });
  } else {
    global = updateCurrentDappTransfer(global, { state: TransferState.Password });
  }

  setGlobal(global);
});

addActionHandler('clearDappTransferError', (global) => {
  global = updateCurrentDappTransfer(global, {
    error: undefined,
  });
  setGlobal(global);
});

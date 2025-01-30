import { TransferState } from '../../types';

import { BROWSER_HISTORY_LIMIT } from '../../../config';
import { unique } from '../../../util/iteratees';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  clearDappConnectRequestError, updateCurrentAccountState, updateCurrentDappTransfer,
} from '../../reducers';
import { selectAccount, selectCurrentAccountState } from '../../selectors';

addActionHandler('clearDappConnectRequestError', (global) => {
  global = clearDappConnectRequestError(global);
  setGlobal(global);
});

addActionHandler('showDappTransfer', (global, actions, payload) => {
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

addActionHandler('openBrowser', (global, actions, { url, title, subtitle }) => {
  global = { ...global, currentBrowserOptions: { url, title, subtitle } };
  setGlobal(global);
});

addActionHandler('closeBrowser', (global) => {
  global = { ...global, currentBrowserOptions: undefined };
  setGlobal(global);
});

addActionHandler('addSiteToBrowserHistory', (global, actions, { url }) => {
  const accountState = selectCurrentAccountState(global);

  const newHistory = unique([
    url,
    ...accountState?.browserHistory || [],
  ]).slice(0, BROWSER_HISTORY_LIMIT);

  global = updateCurrentAccountState(global, {
    browserHistory: newHistory,
  });
  setGlobal(global);
});

addActionHandler('removeSiteFromBrowserHistory', (global, actions, { url }) => {
  const accountState = selectCurrentAccountState(global);

  const newHistory = accountState?.browserHistory?.filter((currentUrl) => currentUrl !== url);

  global = updateCurrentAccountState(global, {
    browserHistory: newHistory?.length ? newHistory : undefined,
  });
  setGlobal(global);
});

addActionHandler('updateDappLastOpenedAt', (global, actions, { origin }) => {
  const { dappLastOpenedDatesByOrigin } = selectCurrentAccountState(global)!;

  const newDates = {
    ...dappLastOpenedDatesByOrigin,
    [origin]: Date.now(),
  };

  global = updateCurrentAccountState(global, { dappLastOpenedDatesByOrigin: newDates });
  setGlobal(global);
});

addActionHandler('openSiteCategory', (global, actions, { id }) => {
  global = updateCurrentAccountState(global, { currentSiteCategoryId: id });
  setGlobal(global);
});

addActionHandler('closeSiteCategory', (global) => {
  global = updateCurrentAccountState(global, { currentSiteCategoryId: undefined });
  setGlobal(global);
});

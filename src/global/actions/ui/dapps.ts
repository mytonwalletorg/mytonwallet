import { TransferState } from '../../types';

import { BROWSER_HISTORY_LIMIT } from '../../../config';
import { unique } from '../../../util/iteratees';
import { callActionInMain } from '../../../util/multitab';
import { openUrl } from '../../../util/openUrl';
import { IS_DELEGATED_BOTTOM_SHEET } from '../../../util/windowEnvironment';
import { closeAllOverlays } from '../../helpers/misc';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  clearDappConnectRequestError, updateCurrentAccountState, updateCurrentDappTransfer,
} from '../../reducers';
import { selectAccount, selectCurrentAccountState } from '../../selectors';
import { switchAccount } from '../api/auth';

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

addActionHandler('openBrowser', (global, actions, {
  url, title, subtitle,
}) => {
  global = {
    ...global,
    currentBrowserOptions: {
      url, title, subtitle,
    },
  };
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
  return updateCurrentAccountState(global, { currentSiteCategoryId: id });
});

addActionHandler('closeSiteCategory', (global) => {
  return updateCurrentAccountState(global, { currentSiteCategoryId: undefined });
});

addActionHandler('switchAccountAndOpenUrl', async (global, actions, payload) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('switchAccountAndOpenUrl', payload);
    return;
  }

  await Promise.all([
    // The browser is closed before opening the new URL, because otherwise the browser won't apply the new
    // parameters from `payload`. It's important to wait for `closeAllOverlays` to finish, because until the in-app
    // browser is closed, it won't open again.
    closeAllOverlays(),
    payload.accountId && switchAccount(global, payload.accountId, payload.network),
  ]);

  await openUrl(payload.url, payload);
});

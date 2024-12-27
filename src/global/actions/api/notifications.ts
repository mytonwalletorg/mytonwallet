import type {
  NotificationsAccountValue,
} from '../../../api/methods';

import { MAX_PUSH_NOTIFICATIONS_ACCOUNT_COUNT } from '../../../config';
import { callApi } from '../../../api';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { selectAccounts } from '../../selectors';
import { selectNotificationTonAddresses } from '../../selectors/notifications';

addActionHandler('registerNotifications', async (global, actions, { userToken, platform }) => {
  const { pushNotifications } = global;

  let createResult;
  let enabledAccounts = Object.keys(pushNotifications.enabledAccounts);
  const accounts = Object.keys(selectAccounts(global) || {});
  if (!pushNotifications.userToken && accounts.length) {
    enabledAccounts = accounts.slice(0, MAX_PUSH_NOTIFICATIONS_ACCOUNT_COUNT);

    createResult = await callApi('subscribeNotifications', {
      userToken,
      platform,
      addresses: selectNotificationTonAddresses(global, enabledAccounts),
    });
  } else if (pushNotifications.userToken !== userToken && enabledAccounts.length) {
    [createResult] = await Promise.all([
      callApi('subscribeNotifications', {
        userToken,
        platform,
        addresses: selectNotificationTonAddresses(global, enabledAccounts),
      }),
      callApi('unsubscribeNotifications', {
        userToken: pushNotifications.userToken!,
        addresses: selectNotificationTonAddresses(global, enabledAccounts),
      }),
    ]);
  }

  global = getGlobal();
  global = {
    ...global,
    pushNotifications: {
      ...global.pushNotifications,
      userToken,
      platform,
    },
  };

  if (!createResult || 'error' in createResult) {
    setGlobal(global);
    return;
  }

  const newEnabledAccounts = enabledAccounts.reduce((acc, accountId) => {
    if (global.accounts?.byId[accountId].addressByChain.ton) {
      acc[accountId] = createResult.addressKeys[global.accounts?.byId[accountId].addressByChain.ton];
    }

    return acc;
  }, {} as Record<string, NotificationsAccountValue>);

  setGlobal({
    ...global,
    pushNotifications: {
      ...global.pushNotifications,
      enabledAccounts: newEnabledAccounts,
    },
  });
});

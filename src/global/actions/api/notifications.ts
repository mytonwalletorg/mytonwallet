import type {
  ApiNotificationsAccountValue,
  ApiSubscribeNotificationsProps,
  ApiSubscribeNotificationsResult,
  ApiUnsubscribeNotificationsProps,
} from '../../../api/types';

import { MAX_PUSH_NOTIFICATIONS_ACCOUNT_COUNT } from '../../../config';
import { createAbortableFunction } from '../../../util/createAbortableFunction';
import { callApi } from '../../../api';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  createNotificationAccount,
  deleteAllNotificationAccounts, deleteNotificationAccount,
  updateNotificationAccount,
} from '../../reducers/notifications';
import { selectAccounts } from '../../selectors';
import { selectNotificationTonAddressesSlow } from '../../selectors/notifications';

const abortableSubscribeNotifications = createAbortableFunction(
  { aborted: true },
  (request: ApiSubscribeNotificationsProps) => {
    return callApi('subscribeNotifications', request);
  },
);

const abortableUnsubscribeNotifications = createAbortableFunction(
  { aborted: true },
  (request: ApiUnsubscribeNotificationsProps) => {
    return callApi('unsubscribeNotifications', request);
  },
);

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
      addresses: selectNotificationTonAddressesSlow(global, enabledAccounts),
    });
  } else if (pushNotifications.userToken !== userToken && enabledAccounts.length) {
    [createResult] = await Promise.all([
      callApi('subscribeNotifications', {
        userToken,
        platform,
        addresses: selectNotificationTonAddressesSlow(global, enabledAccounts),
      }),
      callApi('unsubscribeNotifications', {
        userToken: pushNotifications.userToken!,
        addresses: selectNotificationTonAddressesSlow(global, enabledAccounts),
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
  }, {} as Record<string, ApiNotificationsAccountValue>);

  setGlobal({
    ...global,
    pushNotifications: {
      ...global.pushNotifications,
      enabledAccounts: newEnabledAccounts,
    },
  });
});

addActionHandler('deleteNotificationAccount', async (global, actions, { accountId, withAbort }) => {
  const { userToken, enabledAccounts } = global.pushNotifications;
  const pushNotificationsAccount = enabledAccounts[accountId]!;

  if (!userToken) {
    return;
  }

  setGlobal(deleteNotificationAccount(global, accountId));

  const props = { userToken, addresses: selectNotificationTonAddressesSlow(global, [accountId]) };
  const result = withAbort
    ? await abortableUnsubscribeNotifications(props)
    : await callApi('unsubscribeNotifications', props);

  if (result && 'aborted' in result) {
    return;
  }

  global = getGlobal();

  if (!result || !('ok' in result)) {
    setGlobal(createNotificationAccount(
      global,
      accountId,
      pushNotificationsAccount,
    ));
    return;
  }

  setGlobal(deleteNotificationAccount(global, accountId));
});

addActionHandler('createNotificationAccount', async (global, actions, { accountId, withAbort }) => {
  const { userToken, platform } = global.pushNotifications;

  if (!userToken || !platform) {
    return;
  }

  setGlobal(createNotificationAccount(
    global,
    accountId,
    {},
  ));

  const props = { userToken, platform, addresses: selectNotificationTonAddressesSlow(global, [accountId]) };
  const result = withAbort
    ? await abortableSubscribeNotifications(props)
    : await callApi('subscribeNotifications', props);

  if (result && 'aborted' in result) {
    return;
  }

  global = getGlobal();

  if (!result || !('ok' in result)) {
    setGlobal(deleteNotificationAccount(
      global,
      accountId,
    ));
    return;
  }

  setGlobal(updateNotificationAccount(
    global,
    accountId,
    result.addressKeys[global.accounts!.byId[accountId].addressByChain.ton],
  ));
});

addActionHandler('toggleNotifications', async (global, actions, { isEnabled }) => {
  const {
    enabledAccounts = {}, userToken = '', platform, isAvailable,
  } = global.pushNotifications;

  if (!isAvailable) {
    return;
  }

  let accountIds: string[];

  if (isEnabled) {
    accountIds = Object.keys(selectAccounts(global) || {})
      .slice(0, MAX_PUSH_NOTIFICATIONS_ACCOUNT_COUNT);
    for (const newAccountId of accountIds) {
      global = createNotificationAccount(global, newAccountId, {});
    }
  } else {
    accountIds = Object.keys(enabledAccounts);
    global = deleteAllNotificationAccounts(global);
  }

  setGlobal(global);
  if (!accountIds.length) {
    return;
  }

  const props = { userToken, addresses: selectNotificationTonAddressesSlow(global, accountIds), platform: platform! };
  const result = isEnabled
    ? await abortableSubscribeNotifications(props)
    : await abortableUnsubscribeNotifications(props);

  if (result && 'aborted' in result) {
    return;
  }

  global = getGlobal();

  if (!result || !('ok' in result)) {
    if (isEnabled) {
      global = deleteAllNotificationAccounts(global);
    } else {
      for (const accountId of accountIds) {
        global = createNotificationAccount(global, accountId, enabledAccounts[accountId]);
      }
    }
    setGlobal(global);
    return;
  }

  if (isEnabled && 'addressKeys' in result) {
    const addressKeys = (result as ApiSubscribeNotificationsResult).addressKeys;
    for (const accountId of accountIds) {
      const address = global.accounts!.byId[accountId].addressByChain.ton;

      if (addressKeys[address]) {
        global = createNotificationAccount(global, accountId, addressKeys[address]);
      }
    }
  }

  setGlobal(global);
});

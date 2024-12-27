import type {
  SubscribeNotificationsProps,
  SubscribeNotificationsResult,
  UnsubscribeNotificationsProps,
} from '../../../api/methods';

import { MAX_PUSH_NOTIFICATIONS_ACCOUNT_COUNT } from '../../../config';
import { createAbortableFunction } from '../../../util/createAbortableFunction';
import { callApi } from '../../../api';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  createNotificationAccount,
  deleteAllNotificationAccounts,
  deleteNotificationAccount,
  updateNotificationAccount,
} from '../../reducers/notifications';
import { selectAccounts } from '../../selectors';
import { selectNotificationTonAddresses } from '../../selectors/notifications';

const abortableSubscribeNotifications = createAbortableFunction(
  { aborted: true },
  (request: SubscribeNotificationsProps) => {
    return callApi('subscribeNotifications', request);
  },
);

const abortableUnsubscribeNotifications = createAbortableFunction(
  { aborted: true },
  (request: UnsubscribeNotificationsProps) => {
    return callApi('unsubscribeNotifications', request);
  },
);

addActionHandler('toggleNotifications', async (global, actions, { isEnabled }) => {
  const {
    enabledAccounts = {}, userToken = '', platform, isAvailable,
  } = global.pushNotifications;

  if (!isAvailable) {
    return;
  }

  let accountIds = Object.keys(enabledAccounts);

  if (isEnabled) {
    accountIds = Object.keys(selectAccounts(global) || {})
      .slice(0, MAX_PUSH_NOTIFICATIONS_ACCOUNT_COUNT);
    for (const newAccountId of accountIds) {
      global = createNotificationAccount(global, newAccountId, {});
    }
  } else {
    global = deleteAllNotificationAccounts(global);
  }

  setGlobal(global);
  if (!accountIds.length) {
    return;
  }

  const props = { userToken, addresses: selectNotificationTonAddresses(global, accountIds), platform: platform! };
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
    const addressKeys = (result as SubscribeNotificationsResult).addressKeys;
    for (const accountId of accountIds) {
      const address = global.accounts!.byId[accountId].addressByChain.ton;

      if (addressKeys[address]) {
        global = createNotificationAccount(global, accountId, addressKeys[address]);
      }
    }
  }

  setGlobal(global);
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

  const props = { userToken, platform, addresses: selectNotificationTonAddresses(global, [accountId]) };
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

addActionHandler('tryAddNotificationAccount', (global, actions, { accountId }) => {
  if (
    global.pushNotifications.isAvailable
    && Object.keys(selectAccounts(global) || {}).length <= MAX_PUSH_NOTIFICATIONS_ACCOUNT_COUNT
  ) {
    actions.createNotificationAccount({ accountId });
  }
});

addActionHandler('renameNotificationAccount', (global, actions, { accountId }) => {
  const { enabledAccounts, isAvailable } = global.pushNotifications;

  if (
    isAvailable
    && enabledAccounts?.[accountId]
  ) {
    actions.createNotificationAccount({ accountId });
  }
});

addActionHandler('deleteNotificationAccount', async (global, actions, { accountId, withAbort }) => {
  const { userToken, enabledAccounts } = global.pushNotifications;
  const pushNotificationsAccount = enabledAccounts[accountId]!;

  if (!userToken) {
    return;
  }

  setGlobal(deleteNotificationAccount(global, accountId));

  const props = { userToken, addresses: selectNotificationTonAddresses(global, [accountId]) };
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

addActionHandler('toggleNotificationAccount', (global, actions, { accountId }) => {
  const {
    enabledAccounts, userToken, platform,
  } = global.pushNotifications;

  if (!userToken || !platform) {
    return;
  }

  const isExists = enabledAccounts && enabledAccounts[accountId];

  if (
    !isExists
    && Object.keys(enabledAccounts || {}).length >= MAX_PUSH_NOTIFICATIONS_ACCOUNT_COUNT
  ) {
    return;
  }

  if (isExists) {
    actions.deleteNotificationAccount({ accountId, withAbort: true });
  } else {
    actions.createNotificationAccount({ accountId, withAbort: true });
  }
});

addActionHandler('deleteAllNotificationAccounts', async (global, actions, props) => {
  const {
    enabledAccounts, userToken,
  } = global.pushNotifications;

  if (!enabledAccounts || !userToken) {
    return;
  }

  const accountIds = props?.accountIds || Object.keys(enabledAccounts);

  await callApi(
    'unsubscribeNotifications',
    {
      userToken,
      addresses: selectNotificationTonAddresses(global, accountIds),
    },
  );

  global = getGlobal();
  setGlobal(deleteAllNotificationAccounts(global));
});

import { MAX_PUSH_NOTIFICATIONS_ACCOUNT_COUNT } from '../../../config';
import { callApi } from '../../../api';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  deleteAllNotificationAccounts,
} from '../../reducers/notifications';
import { selectAccounts } from '../../selectors';
import { selectNotificationTonAddressesSlow } from '../../selectors/notifications';

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
      addresses: selectNotificationTonAddressesSlow(global, accountIds),
    },
  );

  global = getGlobal();
  setGlobal(deleteAllNotificationAccounts(global));
});

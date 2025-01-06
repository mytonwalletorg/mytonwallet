import type { ApiNotificationsAccountValue } from '../../api/types';
import type { GlobalState } from '../types';

export function deleteNotificationAccount(
  global: GlobalState,
  accountId: string,
): GlobalState {
  const currentEnabledAccounts = global.pushNotifications.enabledAccounts;

  const { [accountId]: deleted, ...newEnabledAccounts } = currentEnabledAccounts;

  return {
    ...global,
    pushNotifications: {
      ...global.pushNotifications,
      enabledAccounts: newEnabledAccounts,
    },
  };
}

export function deleteAllNotificationAccounts(
  global: GlobalState,
): GlobalState {
  return {
    ...global,
    pushNotifications: {
      ...global.pushNotifications,
      enabledAccounts: {},
    },
  };
}

export function createNotificationAccount(
  global: GlobalState,
  accountId: string,
  value: Partial<ApiNotificationsAccountValue> = {},
): GlobalState {
  const currentEnabledAccounts = global.pushNotifications.enabledAccounts;

  const newEnabledAccounts = { ...currentEnabledAccounts, [accountId]: value };

  return {
    ...global,
    pushNotifications: {
      ...global.pushNotifications,
      enabledAccounts: newEnabledAccounts,
    },
  };
}

export function updateNotificationAccount(
  global: GlobalState,
  accountId: string,
  value: ApiNotificationsAccountValue,
): GlobalState {
  const newEnabledAccounts = global.pushNotifications.enabledAccounts;
  newEnabledAccounts[accountId] = { ...newEnabledAccounts[accountId], ...value };

  return {
    ...global,
    pushNotifications: {
      ...global.pushNotifications,
      enabledAccounts: newEnabledAccounts,
    },
  };
}

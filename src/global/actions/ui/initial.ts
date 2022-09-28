import { addActionHandler, getActions } from '../../index';

import type { NotificationType } from '../../types';

import {
  IS_IOS, IS_ANDROID, IS_MAC_OS, IS_SAFARI, IS_EXTENSION,
} from '../../../util/environment';
import { callApi } from '../../../api';
import { onTickEnd } from '../../../util/schedulers';
import { ApiTransactionDraftError } from '../../../api/types';

addActionHandler('init', () => {
  const { documentElement } = document;

  if (IS_IOS) {
    documentElement.classList.add('is-ios');
  } else if (IS_ANDROID) {
    documentElement.classList.add('is-android');
  } else if (IS_MAC_OS) {
    documentElement.classList.add('is-macos');
  }
  if (IS_SAFARI) {
    documentElement.classList.add('is-safari');
  }
  if (IS_EXTENSION) {
    documentElement.classList.add('is-extension');
  }
});

addActionHandler('showDialog', (global, actions, payload) => {
  const { message } = payload;

  const newDialogs = [...global.dialogs];
  const existingMessageIndex = newDialogs.findIndex((value) => value === message);
  if (existingMessageIndex !== -1) {
    newDialogs.splice(existingMessageIndex, 1);
  }

  newDialogs.push(message);

  return {
    ...global,
    dialogs: newDialogs,
  };
});

addActionHandler('dismissDialog', (global) => {
  const newDialogs = [...global.dialogs];

  newDialogs.pop();

  return {
    ...global,
    dialogs: newDialogs,
  };
});

addActionHandler('selectToken', (global, actions, { slug }) => {
  return {
    ...global,
    currentTokenSlug: slug,
  };
});

addActionHandler('showTxDraftError', (global, actions, { error }) => {
  switch (error) {
    case ApiTransactionDraftError.InvalidAmount:
      actions.showDialog({ message: 'Invalid amount' });
      break;

    case ApiTransactionDraftError.InvalidToAddress:
      actions.showDialog({ message: 'Invalid address' });
      break;

    case ApiTransactionDraftError.InsufficientBalance:
      actions.showDialog({ message: 'Insufficient balance' });
      break;

    case ApiTransactionDraftError.DomainNotResolved:
      actions.showDialog({ message: 'Domain is not connected to a wallet' });
      break;

    default:
      actions.showDialog({ message: 'Unexpected error' });
      break;
  }
});

addActionHandler('showNotification', (global, actions, payload) => {
  const { message, icon } = payload;

  const newNotifications: NotificationType[] = [...global.notifications];
  const existingNotificationIndex = newNotifications.findIndex((n) => n.message === message);
  if (existingNotificationIndex !== -1) {
    newNotifications.splice(existingNotificationIndex, 1);
  }

  newNotifications.push({ message, icon });

  return {
    ...global,
    notifications: newNotifications,
  };
});

addActionHandler('dismissNotification', (global) => {
  const newNotifications = [...global.notifications];

  newNotifications.pop();

  return {
    ...global,
    notifications: newNotifications,
  };
});

addActionHandler('toggleTonProxy', (global, actions, { isEnabled }) => {
  void callApi('doProxy', isEnabled);

  return {
    ...global,
    settings: {
      ...global.settings,
      isTonProxyEnabled: isEnabled,
    },
  };
});

addActionHandler('toggleTonMagic', (global, actions, { isEnabled }) => {
  void callApi('doMagic', isEnabled);

  return {
    ...global,
    settings: {
      ...global.settings,
      isTonMagicEnabled: isEnabled,
    },
  };
});

addActionHandler('signOut', async () => {
  await callApi('resetAccount');

  onTickEnd(() => {
    getActions().init();
  });
});

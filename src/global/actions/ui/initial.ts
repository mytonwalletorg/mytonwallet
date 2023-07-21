import { ApiTransactionDraftError, ApiTransactionError } from '../../../api/types';
import type { NotificationType } from '../../types';

import { IS_ELECTRON } from '../../../config';
import { genRelatedAccountIds } from '../../../util/account';
import { initializeSoundsForSafari } from '../../../util/appSounds';
import { omit } from '../../../util/iteratees';
import { clearPreviousLangpacks, setLanguage } from '../../../util/langProvider';
import switchAnimationLevel from '../../../util/switchAnimationLevel';
import switchTheme from '../../../util/switchTheme';
import {
  IS_ANDROID, IS_EXTENSION,
  IS_IOS, IS_LINUX, IS_MAC_OS, IS_SAFARI,
  IS_WINDOWS, setPageSafeAreaProperty, setScrollbarWidthProperty,
} from '../../../util/windowEnvironment';
import { callApi } from '../../../api';
import {
  addActionHandler, getActions, getGlobal, setGlobal,
} from '../../index';
import { updateCurrentAccountState } from '../../reducers';
import { selectNetworkAccounts, selectNewestTxIds } from '../../selectors';

addActionHandler('init', (_, actions) => {
  const { documentElement } = document;

  if (IS_IOS) {
    documentElement.classList.add('is-ios');
  } else if (IS_ANDROID) {
    documentElement.classList.add('is-android');
  } else if (IS_MAC_OS) {
    documentElement.classList.add('is-macos');
  } else if (IS_WINDOWS) {
    documentElement.classList.add('is-windows');
  } else if (IS_LINUX) {
    documentElement.classList.add('is-linux');
  }
  if (IS_SAFARI) {
    documentElement.classList.add('is-safari');
  }
  if (IS_EXTENSION) {
    documentElement.classList.add('is-extension');
  }
  if (IS_ELECTRON) {
    documentElement.classList.add('is-electron');
  }

  setScrollbarWidthProperty();
  setPageSafeAreaProperty();

  actions.afterInit();
});

addActionHandler('afterInit', (global) => {
  const { theme, animationLevel, langCode } = global.settings;

  switchTheme(theme);
  switchAnimationLevel(animationLevel);
  void setLanguage(langCode);
  clearPreviousLangpacks();

  if (IS_SAFARI || IS_IOS) {
    document.addEventListener('click', initializeSoundsForSafari, { once: true });
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

addActionHandler('selectToken', (global, actions, { slug } = {}) => {
  return updateCurrentAccountState(global, { currentTokenSlug: slug });
});

addActionHandler('showError', (global, actions, { error } = {}) => {
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

    case ApiTransactionDraftError.WalletNotInitialized:
      actions.showDialog({
        message: 'Encryption is not possible. The recipient is not a wallet or has no outgoing transactions.',
      });
      break;

    case ApiTransactionError.PartialTransactionFailure:
      actions.showDialog({ message: 'Not all transactions were sent successfully' });
      break;

    case ApiTransactionError.IncorrectDeviceTime:
      actions.showDialog({ message: 'The time on your device is incorrect, sync it and try again' });
      break;

    case ApiTransactionError.UnsuccesfulTransfer:
      actions.showDialog({ message: 'Transfer was unsuccessful. Try again later' });
      break;

    case ApiTransactionError.UnsupportedHardwarePayload:
      actions.showDialog({ message: 'The hardware wallet does not support this data format' });
      break;

    case ApiTransactionError.Unexpected:
    case undefined:
      actions.showDialog({ message: 'Unexpected' });
      break;

    default:
      actions.showDialog({ message: error });
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

addActionHandler('toggleDeeplinkHook', (global, actions, { isEnabled }) => {
  void callApi('doDeeplinkHook', isEnabled);

  return {
    ...global,
    settings: {
      ...global.settings,
      isDeeplinkHookEnabled: isEnabled,
    },
  };
});

addActionHandler('signOut', async (global, actions, payload) => {
  const { isFromAllAccounts } = payload || {};
  const accountIds = Object.keys(selectNetworkAccounts(global)!);

  if (isFromAllAccounts || accountIds.length === 1) {
    await callApi('resetAccounts');

    getActions().afterSignOut({ isFromAllAccounts: true });
    getActions().init();
  } else {
    const prevAccountId = global.currentAccountId!;
    const nextAccountId = accountIds.find((id) => id !== prevAccountId)!;
    const nextNewestTxIds = selectNewestTxIds(global, nextAccountId);

    await callApi('removeAccount', prevAccountId, nextAccountId, nextNewestTxIds);

    global = getGlobal();

    const prevAccountIds = genRelatedAccountIds(prevAccountId!);
    const accountsById = omit(global.accounts!.byId, prevAccountIds);
    const byAccountId = omit(global.byAccountId, prevAccountIds);

    global = {
      ...global,
      currentAccountId: nextAccountId,
      accounts: {
        ...global.accounts!,
        byId: accountsById,
      },
      byAccountId,
    };

    setGlobal(global);

    getActions().afterSignOut();
  }
});

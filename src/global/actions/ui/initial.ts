import type { Account, AccountState, NotificationType } from '../../types';
import { ApiCommonError, ApiTransactionDraftError, ApiTransactionError } from '../../../api/types';
import { AppState } from '../../types';

import { IS_CAPACITOR, IS_EXTENSION } from '../../../config';
import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { parseAccountId } from '../../../util/account';
import authApi from '../../../util/authApi';
import { processDeeplinkAfterSignIn } from '../../../util/deeplink';
import { omit } from '../../../util/iteratees';
import { clearPreviousLangpacks, setLanguage } from '../../../util/langProvider';
import { callActionInMain } from '../../../util/multitab';
import { initializeSounds } from '../../../util/notificationSound';
import switchAnimationLevel from '../../../util/switchAnimationLevel';
import switchTheme, { setStatusBarStyle } from '../../../util/switchTheme';
import {
  IS_ANDROID,
  IS_DELEGATED_BOTTOM_SHEET,
  IS_ELECTRON,
  IS_IOS,
  IS_LINUX,
  IS_MAC_OS,
  IS_OPERA,
  IS_SAFARI,
  IS_WINDOWS,
  setScrollbarWidthProperty,
} from '../../../util/windowEnvironment';
import { callApi } from '../../../api';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { updateCurrentAccountId, updateCurrentAccountState } from '../../reducers';
import {
  selectCurrentNetwork,
  selectNetworkAccounts,
  selectNetworkAccountsMemoized,
  selectNewestTxIds,
} from '../../selectors';

const ANIMATION_DELAY_MS = 320;

addActionHandler('init', (_, actions) => {
  requestMutation(() => {
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
    if (IS_OPERA) {
      documentElement.classList.add('is-opera');
    }
    if (IS_EXTENSION) {
      documentElement.classList.add('is-extension');
    }
    if (IS_ELECTRON) {
      documentElement.classList.add('is-electron');
    }
    if (IS_DELEGATED_BOTTOM_SHEET) {
      documentElement.classList.add('is-native-bottom-sheet');
    }

    setScrollbarWidthProperty();

    actions.afterInit();
  });
});

addActionHandler('afterInit', (global) => {
  const { theme, animationLevel, langCode } = global.settings;

  switchTheme(theme);
  switchAnimationLevel(animationLevel);
  setStatusBarStyle();
  void setLanguage(langCode);
  clearPreviousLangpacks();

  if (!IS_CAPACITOR) {
    document.addEventListener('click', initializeSounds, { once: true });
  }
});

addActionHandler('afterSignIn', (global, actions) => {
  setGlobal({ ...global, appState: AppState.Main });

  setTimeout(() => {
    actions.resetAuth();
    processDeeplinkAfterSignIn();
  }, ANIMATION_DELAY_MS);
});

addActionHandler('afterSignOut', (global, actions, payload) => {
  if (payload?.isFromAllAccounts) {
    if (IS_CAPACITOR && global.settings.authConfig?.kind === 'native-biometrics') {
      authApi.removeNativeBiometrics();
    }

    actions.resetApiSettings({ areAllDisabled: true });
  }
});

addActionHandler('showDialog', (global, actions, payload) => {
  const { message, title } = payload;

  const newDialogs = [...global.dialogs];
  const existingMessageIndex = newDialogs.findIndex((dialog) => dialog.message === message);
  if (existingMessageIndex !== -1) {
    newDialogs.splice(existingMessageIndex, 1);
  }

  newDialogs.push({ message, title });

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

    case ApiTransactionDraftError.StateInitWithoutBin:
      actions.showDialog({ message: '$state_init_requires_bin' });
      break;

    case ApiTransactionDraftError.InvalidStateInit:
      actions.showDialog({ message: '$state_init_invalid' });
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

    case ApiTransactionDraftError.InvalidAddressFormat:
      actions.showDialog({
        message: 'Invalid address format. Only URL Safe Base64 format is allowed.',
      });
      break;

    case ApiTransactionError.PartialTransactionFailure:
      actions.showDialog({ message: 'Not all transactions were sent successfully' });
      break;

    case ApiTransactionError.IncorrectDeviceTime:
      actions.showDialog({ message: 'The time on your device is incorrect, sync it and try again' });
      break;

    case ApiTransactionError.UnsuccesfulTransfer:
      actions.showDialog({ message: 'Transfer was unsuccessful. Try again later.' });
      break;

    case ApiTransactionDraftError.InactiveContract:
      actions.showDialog({
        message: '$transfer_inactive_contract_error',
      });
      break;

    case ApiTransactionError.NotSupportedHardwareOperation:
      actions.showDialog({
        message: '$ledger_not_supported_operation',
      });
      break;

    case ApiCommonError.ServerError:
      actions.showDialog({
        message: window.navigator.onLine
          ? 'An error on the server side. Please try again.'
          : 'No internet connection. Please check your connection and try again.',
      });
      break;

    case ApiCommonError.DebugError:
      actions.showDialog({ message: 'Unexpected error. Please let the support know.' });
      break;

    case ApiCommonError.Unexpected:
    case undefined:
      actions.showDialog({ message: 'Unexpected' });
      break;

    default:
      actions.showDialog({ message: error });
      break;
  }
});

addActionHandler('showNotification', (global, actions, payload) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('showNotification', payload);
    return undefined;
  }

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
  if (IS_ELECTRON) {
    window.electron?.toggleDeeplinkHandler(isEnabled);
  } else {
    void callApi('doDeeplinkHook', isEnabled);
  }

  return {
    ...global,
    settings: {
      ...global.settings,
      isDeeplinkHookEnabled: isEnabled,
    },
  };
});

addActionHandler('signOut', async (global, actions, payload) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('signOut', payload);
  }

  const { isFromAllAccounts } = payload || {};

  const network = selectCurrentNetwork(global);
  const accountIds = Object.keys(selectNetworkAccounts(global)!);

  const otherNetwork = network === 'mainnet' ? 'testnet' : 'mainnet';
  const otherNetworkAccountIds = Object.keys(selectNetworkAccountsMemoized(otherNetwork, global.accounts?.byId)!);

  if (isFromAllAccounts || accountIds.length === 1) {
    if (otherNetworkAccountIds.length) {
      await callApi('removeNetworkAccounts', network);

      global = getGlobal();

      const nextAccountId = otherNetworkAccountIds[0];
      const accountsById = Object.entries(global.accounts!.byId).reduce((byId, [accountId, account]) => {
        if (parseAccountId(accountId).network !== network) {
          byId[accountId] = account;
        }
        return byId;
      }, {} as Record<string, Account>);
      const byAccountId = Object.entries(global.byAccountId).reduce((byId, [accountId, state]) => {
        if (parseAccountId(accountId).network !== network) {
          byId[accountId] = state;
        }
        return byId;
      }, {} as Record<string, AccountState>);

      global = updateCurrentAccountId(global, nextAccountId);

      global = {
        ...global,
        accounts: {
          ...global.accounts!,
          byId: accountsById,
        },
        byAccountId,
      };

      setGlobal(global);

      actions.switchAccount({ accountId: nextAccountId, newNetwork: otherNetwork });
      actions.closeSettings();
      actions.afterSignOut();
    } else {
      await callApi('resetAccounts');

      actions.afterSignOut({ isFromAllAccounts: true });
      actions.init();
    }
  } else {
    const prevAccountId = global.currentAccountId!;
    const nextAccountId = accountIds.find((id) => id !== prevAccountId)!;
    const nextNewestTxIds = selectNewestTxIds(global, nextAccountId);

    await callApi('removeAccount', prevAccountId, nextAccountId, nextNewestTxIds);

    global = getGlobal();

    const accountsById = omit(global.accounts!.byId, [prevAccountId]);
    const byAccountId = omit(global.byAccountId, [prevAccountId]);

    global = updateCurrentAccountId(global, nextAccountId);

    global = {
      ...global,
      accounts: {
        ...global.accounts!,
        byId: accountsById,
      },
      byAccountId,
    };

    setGlobal(global);

    actions.afterSignOut();
  }
});

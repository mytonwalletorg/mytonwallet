import type {
  Account, AccountSettings, AccountState, NotificationType,
} from '../../types';
import { ApiAuthError, ApiCommonError, ApiTransactionDraftError, ApiTransactionError } from '../../../api/types';
import { AppState } from '../../types';

import {
  DEFAULT_SWAP_FIRST_TOKEN_SLUG,
  DEFAULT_SWAP_SECOND_TOKEN_SLUG,
  DEFAULT_TRANSFER_TOKEN_SLUG,
  IS_CAPACITOR,
  IS_EXTENSION,
  IS_TELEGRAM_APP,
  TONCOIN,
} from '../../../config';
import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { parseAccountId } from '../../../util/account';
import authApi from '../../../util/authApi';
import { initCapacitorWithGlobal } from '../../../util/capacitor';
import { processDeeplinkAfterSignIn } from '../../../util/deeplink';
import { omit } from '../../../util/iteratees';
import { clearPreviousLangpacks, setLanguage } from '../../../util/langProvider';
import { callActionInMain, callActionInNative } from '../../../util/multitab';
import { initializeSounds } from '../../../util/notificationSound';
import switchAnimationLevel from '../../../util/switchAnimationLevel';
import switchTheme, { setStatusBarStyle } from '../../../util/switchTheme';
import { initTelegramWithGlobal } from '../../../util/telegram';
import {
  getIsMobileTelegramApp,
  IS_ANDROID,
  IS_ANDROID_APP,
  IS_DELEGATED_BOTTOM_SHEET,
  IS_DELEGATING_BOTTOM_SHEET,
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
  selectNewestActivityTimestamps,
  selectSwapTokens,
} from '../../selectors';

const ANIMATION_DELAY_MS = 320;

addActionHandler('init', (_, actions) => {
  requestMutation(() => {
    const { documentElement } = document;

    if (IS_IOS) {
      documentElement.classList.add('is-ios', 'is-mobile');
    } else if (IS_ANDROID) {
      documentElement.classList.add('is-android', 'is-mobile');
      if (IS_ANDROID_APP) {
        documentElement.classList.add('is-android-app');
      }
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
    if (IS_TELEGRAM_APP) {
      documentElement.classList.add('is-telegram-app');
    }
    if (getIsMobileTelegramApp()) {
      documentElement.classList.add('is-mobile-telegram-app');
    }
    if (IS_DELEGATED_BOTTOM_SHEET) {
      documentElement.classList.add('is-native-bottom-sheet');
    }

    setScrollbarWidthProperty();

    actions.afterInit();
  });
});

addActionHandler('afterInit', (global) => {
  const {
    theme, animationLevel, langCode, authConfig,
  } = global.settings;

  switchTheme(theme);
  switchAnimationLevel(animationLevel);
  setStatusBarStyle({
    forceDarkBackground: false,
  });
  void setLanguage(langCode);
  clearPreviousLangpacks();

  if (IS_CAPACITOR) {
    void initCapacitorWithGlobal(authConfig);
  } else {
    if (IS_TELEGRAM_APP) {
      initTelegramWithGlobal(global);
    }

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
  if (payload?.shouldReset) {
    if (global.settings.authConfig?.kind === 'native-biometrics') {
      void authApi.removeNativeBiometrics();
    }
    actions.setInMemoryPassword({ password: undefined, force: true });

    actions.resetApiSettings({ areAllDisabled: true });
  }
});

addActionHandler('showDialog', (global, actions, payload) => {
  const newDialogs = [...global.dialogs];
  const existingMessageIndex = newDialogs.findIndex((dialog) => dialog.message === payload.message);
  if (existingMessageIndex !== -1) {
    newDialogs.splice(existingMessageIndex, 1);
  }

  newDialogs.push(payload);

  return {
    ...global,
    dialogs: newDialogs,
  };
});

addActionHandler('dismissDialog', (global) => {
  if (IS_DELEGATING_BOTTOM_SHEET) {
    callActionInNative('dismissDialog');
  }

  const newDialogs = [...global.dialogs];

  newDialogs.pop();

  return {
    ...global,
    dialogs: newDialogs,
  };
});

addActionHandler('selectToken', (global, actions, { slug } = {}) => {
  if (slug) {
    const isToncoin = slug === TONCOIN.slug;
    const tokens = selectSwapTokens(global);

    if (isToncoin || tokens?.some((token) => token.slug === slug)) {
      if (isToncoin) {
        actions.setDefaultSwapParams({ tokenInSlug: DEFAULT_SWAP_SECOND_TOKEN_SLUG, tokenOutSlug: slug });
      } else {
        actions.setDefaultSwapParams({ tokenOutSlug: slug });
      }
      actions.changeTransferToken({ tokenSlug: slug });
    }
  } else {
    const currentActivityToken = global.byAccountId[global.currentAccountId!].currentTokenSlug;

    const isDefaultFirstTokenOutSwap = global.currentSwap.tokenOutSlug === DEFAULT_SWAP_FIRST_TOKEN_SLUG
      && global.currentSwap.tokenInSlug === DEFAULT_SWAP_SECOND_TOKEN_SLUG;

    const shouldResetSwap = global.currentSwap.tokenOutSlug === currentActivityToken
      && (
        (
          global.currentSwap.tokenInSlug === DEFAULT_SWAP_FIRST_TOKEN_SLUG
          && global.currentSwap.tokenOutSlug !== DEFAULT_SWAP_SECOND_TOKEN_SLUG
        )
        || isDefaultFirstTokenOutSwap
      );

    if (shouldResetSwap) {
      actions.setDefaultSwapParams({ tokenInSlug: undefined, tokenOutSlug: undefined, withResetAmount: true });
    }

    const shouldResetTransfer = (global.currentTransfer.tokenSlug === currentActivityToken
      && global.currentTransfer.tokenSlug !== DEFAULT_TRANSFER_TOKEN_SLUG)
    && !global.currentTransfer.nfts?.length;

    if (shouldResetTransfer) {
      actions.changeTransferToken({ tokenSlug: DEFAULT_TRANSFER_TOKEN_SLUG, withResetAmount: true });
    }
  }

  return updateCurrentAccountState(global, { currentTokenSlug: slug });
});

addActionHandler('showError', (global, actions, { error } = {}) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('showError', { error });
    return;
  }

  switch (error) {
    case ApiTransactionDraftError.InvalidAmount:
      actions.showDialog({ message: 'Invalid amount' });
      break;

    case ApiAuthError.InvalidAddress:
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

    case ApiAuthError.DomainNotResolved:
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
    void window.electron?.toggleDeeplinkHandler(isEnabled);
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

  const { level } = payload;

  const network = selectCurrentNetwork(global);
  const accounts = selectNetworkAccounts(global)!;
  const accountIds = Object.keys(accounts);
  const isFromAllAccounts = level !== 'account';

  const otherNetwork = network === 'mainnet' ? 'testnet' : 'mainnet';
  let otherNetworkAccountIds = Object.keys(selectNetworkAccountsMemoized(otherNetwork, global.accounts?.byId)!);

  if (level === 'all' && otherNetworkAccountIds.length > 0) {
    await callApi('removeNetworkAccounts', otherNetwork);
    otherNetworkAccountIds = [];
  }

  if (isFromAllAccounts || accountIds.length === 1) {
    actions.deleteAllNotificationAccounts({ accountIds });
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

      const settingsById = Object.entries(global.settings.byAccountId).reduce((byId, [accountId, settings]) => {
        if (parseAccountId(accountId).network !== network) {
          byId[accountId] = settings;
        }
        return byId;
      }, {} as Record<string, AccountSettings>);

      global = updateCurrentAccountId(global, nextAccountId);

      global = {
        ...global,
        accounts: {
          ...global.accounts!,
          byId: accountsById,
        },
        byAccountId,
        settings: {
          ...global.settings,
          byAccountId: settingsById,
        },
      };

      setGlobal(global);

      actions.switchAccount({ accountId: nextAccountId, newNetwork: otherNetwork });
      actions.closeSettings();
      actions.afterSignOut();
    } else {
      await callApi('resetAccounts');

      actions.afterSignOut({ shouldReset: true });
      actions.init();
    }
  } else {
    const prevAccountId = global.currentAccountId!;
    const nextAccountId = accountIds.find((id) => id !== prevAccountId)!;
    const nextNewestActivityTimestamps = selectNewestActivityTimestamps(global, nextAccountId);

    await callApi('removeAccount', prevAccountId, nextAccountId, nextNewestActivityTimestamps);
    actions.deleteNotificationAccount({ accountId: prevAccountId });

    global = getGlobal();

    const accountsById = omit(global.accounts!.byId, [prevAccountId]);
    const byAccountId = omit(global.byAccountId, [prevAccountId]);
    const settingsByAccountId = omit(global.settings.byAccountId, [prevAccountId]);

    global = updateCurrentAccountId(global, nextAccountId);

    global = {
      ...global,
      accounts: {
        ...global.accounts!,
        byId: accountsById,
      },
      byAccountId,
      settings: {
        ...global.settings,
        byAccountId: settingsByAccountId,
      },
    };

    setGlobal(global);

    actions.afterSignOut();
  }
});

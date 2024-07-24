import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

import type { GlobalState } from '../../types';
import {
  AppState, AuthState, HardwareConnectState, SettingsState, SwapState, TransferState,
} from '../../types';

import {
  ANIMATION_LEVEL_MIN,
  APP_VERSION,
  BETA_URL,
  BOT_USERNAME,
  DEBUG,
  IS_CAPACITOR,
  IS_EXTENSION,
  IS_PRODUCTION,
  PRODUCTION_URL,
} from '../../../config';
import { vibrateOnSuccess } from '../../../util/capacitor';
import { isTonDeeplink, parseTonDeeplink, processDeeplink } from '../../../util/deeplink';
import getIsAppUpdateNeeded from '../../../util/getIsAppUpdateNeeded';
import { isTonAddressOrDomain } from '../../../util/isTonAddressOrDomain';
import { omitUndefined, pick, unique } from '../../../util/iteratees';
import { getTranslation } from '../../../util/langProvider';
import { onLedgerTabClose, openLedgerTab } from '../../../util/ledger/tab';
import { callActionInMain } from '../../../util/multitab';
import { openUrl } from '../../../util/openUrl';
import { pause } from '../../../util/schedulers';
import {
  IS_ANDROID_APP,
  IS_BIOMETRIC_AUTH_SUPPORTED,
  IS_DELEGATED_BOTTOM_SHEET,
} from '../../../util/windowEnvironment';
import { callApi } from '../../../api';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  clearCurrentSwap,
  clearCurrentTransfer,
  clearIsPinAccepted,
  renameAccount,
  setIsPinAccepted,
  updateAccounts,
  updateAccountState,
  updateAuth,
  updateCurrentAccountState,
  updateCurrentSwap,
  updateCurrentTransfer,
  updateHardware,
  updateSettings,
} from '../../reducers';
import {
  selectAccountSettings,
  selectAccountState,
  selectCurrentAccount,
  selectCurrentAccountState,
  selectCurrentAccountTokens,
  selectFirstNonHardwareAccount,
} from '../../selectors';

const OPEN_LEDGER_TAB_DELAY = 500;
const APP_VERSION_URL = IS_ANDROID_APP ? `${IS_PRODUCTION ? PRODUCTION_URL : BETA_URL}/version.txt` : 'version.txt';

addActionHandler('showActivityInfo', (global, actions, { id }) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('showActivityInfo', { id });
    return undefined;
  }

  return updateCurrentAccountState(global, { currentActivityId: id });
});

addActionHandler('closeActivityInfo', (global, actions, { id }) => {
  if (selectCurrentAccountState(global)?.currentActivityId !== id) {
    return undefined;
  }

  return updateCurrentAccountState(global, { currentActivityId: undefined });
});

addActionHandler('addSavedAddress', (global, actions, { address, name }) => {
  const { savedAddresses } = selectCurrentAccountState(global) || {};

  return updateCurrentAccountState(global, {
    savedAddresses: {
      ...savedAddresses,
      [address]: name,
    },
  });
});

addActionHandler('removeFromSavedAddress', (global, actions, { address }) => {
  const { [address]: omit, ...savedAddresses } = selectCurrentAccountState(global)?.savedAddresses || {};

  return updateCurrentAccountState(global, { savedAddresses });
});

addActionHandler('toggleTinyTransfersHidden', (global, actions, { isEnabled } = {}) => {
  return {
    ...global,
    settings: {
      ...global.settings,
      areTinyTransfersHidden: isEnabled,
    },
  };
});

addActionHandler('setCurrentTokenPeriod', (global, actions, { period }) => {
  return updateCurrentAccountState(global, {
    currentTokenPeriod: period,
  });
});

addActionHandler('addAccount', async (global, actions, { method, password, isAuthFlow }) => {
  const firstNonHardwareAccount = selectFirstNonHardwareAccount(global);
  const isMnemonicImport = method === 'importMnemonic';

  if (firstNonHardwareAccount) {
    if (!(await callApi('verifyPassword', password))) {
      global = getGlobal();
      if (isAuthFlow) {
        global = updateAuth(global, {
          isLoading: undefined,
          error: 'Wrong password, please try again.',
        });
      } else {
        global = updateAccounts(getGlobal(), {
          isLoading: undefined,
          error: 'Wrong password, please try again.',
        });
      }
      setGlobal(global);
      return;
    }

    if (IS_CAPACITOR) {
      global = setIsPinAccepted(getGlobal());
      setGlobal(global);

      await vibrateOnSuccess(true);
    }
  }

  global = getGlobal();
  if (isMnemonicImport || !firstNonHardwareAccount) {
    global = { ...global, isAddAccountModalOpen: undefined };
  } else {
    global = updateAccounts(global, { isLoading: true });
  }
  setGlobal(global);

  if (!IS_DELEGATED_BOTTOM_SHEET) {
    actions.addAccount2({ method, password });
  } else {
    callActionInMain('addAccount2', { method, password });
  }
});

addActionHandler('addAccount2', (global, actions, { method, password }) => {
  const isMnemonicImport = method === 'importMnemonic';
  const firstNonHardwareAccount = selectFirstNonHardwareAccount(global);
  const authState = firstNonHardwareAccount
    ? isMnemonicImport
      ? AuthState.importWallet
      : undefined
    : (IS_CAPACITOR
      ? AuthState.createPin
      : (IS_BIOMETRIC_AUTH_SUPPORTED ? AuthState.createBiometrics : AuthState.createPassword)
    );

  if (isMnemonicImport || !firstNonHardwareAccount) {
    global = { ...global, appState: AppState.Auth };
  }
  global = updateAuth(global, { password, state: authState });
  global = clearCurrentTransfer(global);
  global = clearCurrentSwap(global);

  setGlobal(global);

  if (isMnemonicImport) {
    actions.startImportingWallet();
  } else {
    actions.startCreatingWallet();
  }
});

addActionHandler('renameAccount', (global, actions, { accountId, title }) => {
  global = { ...global, shouldForceAccountEdit: false };
  return renameAccount(global, accountId, title);
});

addActionHandler('clearAccountError', (global) => {
  return updateAccounts(global, { error: undefined });
});

addActionHandler('openAddAccountModal', (global) => {
  return { ...global, isAddAccountModalOpen: true };
});

addActionHandler('closeAddAccountModal', (global) => {
  if (IS_CAPACITOR) {
    global = clearIsPinAccepted(global);
  }

  return { ...global, isAddAccountModalOpen: undefined };
});

addActionHandler('setTheme', (global, actions, { theme }) => {
  return {
    ...global,
    settings: {
      ...global.settings,
      theme,
    },
  };
});

addActionHandler('setAnimationLevel', (global, actions, { level }) => {
  return {
    ...global,
    settings: {
      ...global.settings,
      animationLevel: level,
    },
  };
});

addActionHandler('changeNetwork', (global, actions, { network }) => {
  return {
    ...global,
    settings: {
      ...global.settings,
      isTestnet: network === 'testnet',
    },
  };
});

addActionHandler('openSettings', (global) => {
  global = updateSettings(global, { state: SettingsState.Initial });
  setGlobal({ ...global, areSettingsOpen: true });
});

addActionHandler('openSettingsWithState', (global, actions, { state }) => {
  if (IS_DELEGATED_BOTTOM_SHEET && !global.areSettingsOpen) {
    callActionInMain('openSettingsWithState', { state });
    return;
  }

  global = updateSettings(global, { state });
  setGlobal({ ...global, areSettingsOpen: true });
});

addActionHandler('setSettingsState', (global, actions, { state }) => {
  global = updateSettings(global, { state });
  setGlobal(global);
});

addActionHandler('closeSettings', (global) => {
  if (!global.currentAccountId) {
    return global;
  }

  return { ...global, areSettingsOpen: false };
});

addActionHandler('openBackupWalletModal', (global) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('openBackupWalletModal');
    return undefined;
  }

  return { ...global, isBackupWalletModalOpen: true };
});

addActionHandler('closeBackupWalletModal', (global) => {
  return { ...global, isBackupWalletModalOpen: undefined };
});

addActionHandler('initializeHardwareWalletConnection', async (global, actions) => {
  const startConnection = () => {
    global = updateHardware(getGlobal(), {
      hardwareState: HardwareConnectState.Connecting,
    });
    setGlobal(global);

    actions.connectHardwareWallet();
  };

  const ledgerApi = await import('../../../util/ledger');

  if (await ledgerApi.connectLedger()) {
    startConnection();
    return;
  }

  if (IS_EXTENSION) {
    global = updateHardware(getGlobal(), {
      hardwareState: HardwareConnectState.WaitingForBrowser,
    });
    setGlobal(global);

    await pause(OPEN_LEDGER_TAB_DELAY);
    const id = await openLedgerTab();
    const popup = await chrome.windows.getCurrent();

    onLedgerTabClose(id, async () => {
      await chrome.windows.update(popup.id!, { focused: true });

      if (!await ledgerApi.connectLedger()) {
        actions.closeHardwareWalletModal();
        return;
      }

      startConnection();
    });
  }
});

addActionHandler('openHardwareWalletModal', async (global) => {
  const ledgerApi = await import('../../../util/ledger');
  let newHardwareState;

  const isConnected = await ledgerApi.connectLedger();

  if (!isConnected && IS_EXTENSION) {
    newHardwareState = HardwareConnectState.WaitingForBrowser;
  } else {
    newHardwareState = HardwareConnectState.Connect;
  }

  global = updateHardware(getGlobal(), {
    hardwareState: newHardwareState,
  });
  setGlobal({ ...global, isHardwareModalOpen: true });
});

addActionHandler('closeHardwareWalletModal', (global) => {
  setGlobal({ ...global, isHardwareModalOpen: false });
});

addActionHandler('toggleInvestorView', (global, actions, { isEnabled } = {}) => {
  return {
    ...global,
    settings: {
      ...global.settings,
      isInvestorViewEnabled: isEnabled,
    },
  };
});

addActionHandler('changeLanguage', (global, actions, { langCode }) => {
  return {
    ...global,
    settings: {
      ...global.settings,
      langCode,
    },
  };
});

addActionHandler('toggleCanPlaySounds', (global, actions, { isEnabled } = {}) => {
  return {
    ...global,
    settings: {
      ...global.settings,
      canPlaySounds: isEnabled,
    },
  };
});

addActionHandler('setLandscapeActionsActiveTabIndex', (global, actions, { index }) => {
  return updateCurrentAccountState(global, {
    landscapeActionsActiveTabIndex: index,
  });
});

addActionHandler('closeSecurityWarning', (global) => {
  return {
    ...global,
    settings: {
      ...global.settings,
      isSecurityWarningHidden: true,
    },
  };
});

addActionHandler('toggleTokensWithNoCost', (global, actions, { isEnabled }) => {
  const accountId = global.currentAccountId!;
  const accountSettings = selectAccountSettings(global, accountId) ?? {};

  setGlobal(updateSettings(global, {
    areTokensWithNoCostHidden: isEnabled,
    byAccountId: {
      ...global.settings.byAccountId,
      [accountId]: {
        ...accountSettings,
        exceptionSlugs: [],
      },
    },
  }));
});

addActionHandler('toggleSortByValue', (global, actions, { isEnabled }) => {
  setGlobal(updateSettings(global, {
    isSortByValueEnabled: isEnabled,
  }));
});

addActionHandler('initTokensOrder', (global) => {
  const accountId = global.currentAccountId!;
  const accountSettings = selectAccountSettings(global, accountId) ?? {};
  const accountTokens = selectCurrentAccountTokens(global) ?? [];
  const { orderedSlugs = [] } = accountSettings;
  const newSlugs = accountTokens.map(({ slug }) => slug);

  const updatedSlugs = unique([...orderedSlugs, ...newSlugs]);

  setGlobal(updateSettings(global, {
    byAccountId: {
      ...global.settings.byAccountId,
      [accountId]: {
        ...accountSettings,
        orderedSlugs: updatedSlugs,
      },
    },
  }));
});

addActionHandler('updateDeletionListForActiveTokens', (global, actions, payload) => {
  const { accountId = global.currentAccountId } = payload ?? {};
  if (!accountId) {
    return;
  }

  const { balances } = selectAccountState(global, accountId) ?? {};
  const accountSettings = selectAccountSettings(global, accountId) ?? {};
  const accountTokens = selectCurrentAccountTokens(global) ?? [];
  const deletedSlugs = accountSettings.deletedSlugs ?? [];

  const updatedDeletedSlugs = deletedSlugs.filter(
    (slug) => !accountTokens.some((token) => token.slug === slug && token.amount > 0),
  );

  const balancesBySlug = balances?.bySlug ?? {};
  const updatedBalancesBySlug = Object.fromEntries(
    Object.entries(balancesBySlug).filter(([slug]) => !updatedDeletedSlugs.includes(slug)),
  );

  global = updateAccountState(global, accountId, {
    balances: {
      ...balances,
      bySlug: updatedBalancesBySlug,
    },
  });

  global = updateSettings(global, {
    byAccountId: {
      ...global.settings.byAccountId,
      [accountId]: {
        ...accountSettings,
        deletedSlugs: updatedDeletedSlugs,
      },
    },
  });

  setGlobal(global);

  actions.initTokensOrder();
});

addActionHandler('sortTokens', (global, actions, { orderedSlugs }) => {
  const accountId = global.currentAccountId!;
  const accountSettings = selectAccountSettings(global, accountId);

  setGlobal(updateSettings(global, {
    byAccountId: {
      ...global.settings.byAccountId,
      [accountId]: {
        ...accountSettings,
        orderedSlugs,
      },
    },
  }));
});

addActionHandler('toggleExceptionToken', (global, actions, { slug }) => {
  const accountId = global.currentAccountId!;
  const accountSettings = selectAccountSettings(global, accountId) ?? {};
  const { exceptionSlugs = [] } = accountSettings;

  const exceptionSlugsCopy = exceptionSlugs.slice();
  const slugIndexInAvailable = exceptionSlugsCopy.indexOf(slug);

  if (slugIndexInAvailable !== -1) {
    exceptionSlugsCopy.splice(slugIndexInAvailable, 1);
  } else {
    exceptionSlugsCopy.push(slug);
  }

  setGlobal(updateSettings(global, {
    byAccountId: {
      ...global.settings.byAccountId,
      [accountId]: {
        ...accountSettings,
        exceptionSlugs: exceptionSlugsCopy,
      },
    },
  }));
});

addActionHandler('deleteToken', (global, actions, { slug }) => {
  const accountId = global.currentAccountId!;
  const { balances } = selectAccountState(global, accountId) ?? {};

  if (balances?.bySlug[slug] === undefined) {
    return;
  }

  const { [slug]: deleted, ...bySlugCopy } = { ...balances?.bySlug };

  global = updateAccountState(global, accountId, {
    balances: {
      ...balances,
      bySlug: {
        ...bySlugCopy,
      },
    },
  });

  const accountSettings = selectAccountSettings(global, accountId) ?? {};
  const orderedSlugs = accountSettings.orderedSlugs?.filter((s) => s !== slug);
  const exceptionSlugs = accountSettings.exceptionSlugs?.filter((s) => s !== slug);
  const deletedSlugs = [...accountSettings.deletedSlugs ?? [], slug];

  global = updateSettings(global, {
    byAccountId: {
      ...global.settings.byAccountId,
      [accountId]: {
        ...accountSettings,
        orderedSlugs,
        exceptionSlugs,
        deletedSlugs,
      },
    },
  });

  setGlobal(global);
});

addActionHandler('checkAppVersion', (global) => {
  fetch(`${APP_VERSION_URL}?${Date.now()}`)
    .then((response) => response.text())
    .then((version) => {
      version = version.trim();

      if (getIsAppUpdateNeeded(version, APP_VERSION)) {
        global = getGlobal();
        global = {
          ...global,
          isAppUpdateAvailable: true,
          latestAppVersion: version.trim(),
        };
        setGlobal(global);
      }
    })
    .catch((err) => {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.error('[checkAppVersion failed] ', err);
      }
    });
});

addActionHandler('requestConfetti', (global) => {
  if (global.settings.animationLevel === ANIMATION_LEVEL_MIN) return global;

  return {
    ...global,
    confettiRequestedAt: Date.now(),
  };
});

addActionHandler('requestOpenQrScanner', async (global, actions) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('requestOpenQrScanner');
    return;
  }

  let currentQrScan: GlobalState['currentQrScan'];
  if (global.currentTransfer.state === TransferState.Initial) {
    currentQrScan = { currentTransfer: global.currentTransfer };
  } else if (global.currentSwap.state === SwapState.Blockchain) {
    currentQrScan = { currentSwap: global.currentSwap };
  }

  const { camera } = await BarcodeScanner.requestPermissions();
  const isGranted = camera === 'granted' || camera === 'limited';
  if (!isGranted) {
    actions.showNotification({
      message: getTranslation('Permission denied. Please grant camera permission to use the QR code scanner.'),
    });
    return;
  }

  global = getGlobal();
  global = {
    ...global,
    isQrScannerOpen: true,
    currentQrScan,
  };

  setGlobal(global);
});

addActionHandler('closeQrScanner', (global) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('closeQrScanner');
    return undefined;
  }

  return {
    ...global,
    isQrScannerOpen: undefined,
    currentQrScan: undefined,
  };
});

addActionHandler('handleQrCode', (global, actions, { data }) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('handleQrCode', { data });
    return undefined;
  }

  const { currentTransfer, currentSwap } = global.currentQrScan || {};

  if (currentTransfer) {
    if (isTonAddressOrDomain(data)) {
      return updateCurrentTransfer(global, {
        ...currentTransfer,
        toAddress: data,
      });
    }

    const linkParams = isTonDeeplink(data) ? parseTonDeeplink(data) : undefined;
    if (linkParams) {
      return updateCurrentTransfer(global, {
        ...currentTransfer,
        // For NFT transfer we only extract address from a ton:// link
        ...(currentTransfer.nfts?.length ? pick(linkParams, ['toAddress']) : omitUndefined(linkParams)),
      });
    }
  }

  if (currentSwap) {
    return updateCurrentSwap(global, {
      ...currentSwap,
      toAddress: data,
    });
  }

  processDeeplink(data);

  return undefined;
});

addActionHandler('changeBaseCurrency', async (global, actions, { currency }) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('changeBaseCurrency', { currency });
  }

  await callApi('setBaseCurrency', currency);
  await callApi('tryUpdatePrices');

  await Promise.all([
    callApi('tryUpdateTokens'),
    callApi('tryLoadSwapTokens'),
  ]);
});

addActionHandler('setIsPinAccepted', (global) => {
  return setIsPinAccepted(global);
});

addActionHandler('clearIsPinAccepted', (global) => {
  return clearIsPinAccepted(global);
});

addActionHandler('openOnRampWidgetModal', (global) => {
  setGlobal({ ...global, isOnRampWidgetModalOpen: true });
});

addActionHandler('closeOnRampWidgetModal', (global) => {
  setGlobal({ ...global, isOnRampWidgetModalOpen: undefined });
});

addActionHandler('openMediaViewer', (global, actions, {
  mediaId, mediaType, txId, hiddenNfts, noGhostAnimation,
}) => {
  return {
    ...global,
    mediaViewer: {
      mediaId,
      mediaType,
      txId,
      hiddenNfts,
      noGhostAnimation,
    },
  };
});

addActionHandler('closeMediaViewer', (global) => {
  return {
    ...global,
    mediaViewer: {
      mediaId: undefined,
      mediaType: undefined,
    },
  };
});

addActionHandler('openReceiveModal', (global) => {
  setGlobal({ ...global, isReceiveModalOpen: true });
});

addActionHandler('closeReceiveModal', (global) => {
  setGlobal({ ...global, isReceiveModalOpen: undefined });
});

addActionHandler('showIncorrectTimeError', (global, actions) => {
  actions.showDialog({
    message: getTranslation('Time synchronization issue. Please ensure your device\'s time settings are correct.'),
  });

  return { ...global, isIncorrectTimeNotificationReceived: true };
});

addActionHandler('initLedgerPage', (global) => {
  global = updateHardware(global, {
    isRemoteTab: true,
  });
  setGlobal({ ...global, appState: AppState.Ledger });
});

addActionHandler('openLoadingOverlay', (global) => {
  setGlobal({ ...global, isLoadingOverlayOpen: true });
});

addActionHandler('closeLoadingOverlay', (global) => {
  setGlobal({ ...global, isLoadingOverlayOpen: undefined });
});

addActionHandler('clearAccountLoading', (global) => {
  setGlobal(updateAccounts(global, { isLoading: undefined }));
});

addActionHandler('authorizeDiesel', (global) => {
  const address = selectCurrentAccount(global)!.address;
  setGlobal(updateCurrentAccountState(global, { isDieselAuthorizationStarted: true }));
  openUrl(`https://t.me/${BOT_USERNAME}?start=auth-${address}`, true);
});

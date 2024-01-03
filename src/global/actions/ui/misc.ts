import {
  AppState, AuthState, HardwareConnectState, SettingsState,
} from '../../types';

import {
  ANIMATION_LEVEL_MIN, APP_VERSION, DEBUG, IS_CAPACITOR, IS_EXTENSION,
} from '../../../config';
import {
  processDeeplink as processTonConnectDeeplink,
  vibrateOnSuccess,
} from '../../../util/capacitor';
import { getIsAddressValid } from '../../../util/getIsAddressValid';
import getIsAppUpdateNeeded from '../../../util/getIsAppUpdateNeeded';
import { unique } from '../../../util/iteratees';
import { onLedgerTabClose, openLedgerTab } from '../../../util/ledger/tab';
import { processDeeplink } from '../../../util/processDeeplink';
import { pause } from '../../../util/schedulers';
import { isTonConnectDeeplink } from '../../../util/ton/deeplinks';
import { IS_DELEGATED_BOTTOM_SHEET } from '../../../util/windowEnvironment';
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
  updateHardware,
  updateSettings,
} from '../../reducers';
import {
  selectAccountSettings,
  selectAccountState,
  selectCurrentAccountState,
  selectCurrentAccountTokens,
  selectFirstNonHardwareAccount,
} from '../../selectors';

import { callActionInMain } from '../../../hooks/useDelegatedBottomSheet';

const OPEN_LEDGER_TAB_DELAY = 500;
const APP_VERSION_URL = 'version.txt';

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

addActionHandler('addAccount', async (global, actions, { method, password }) => {
  const firstNonHardwareAccount = selectFirstNonHardwareAccount(global);

  if (firstNonHardwareAccount) {
    if (!(await callApi('verifyPassword', password))) {
      setGlobal(updateAccounts(getGlobal(), {
        isLoading: undefined,
        error: 'Wrong password, please try again.',
      }));
      return;
    }

    if (IS_CAPACITOR) {
      global = setIsPinAccepted(getGlobal());
      setGlobal(global);

      await vibrateOnSuccess(true);
    }
  }

  global = getGlobal();
  global = { ...global, isAddAccountModalOpen: undefined };
  setGlobal(global);

  if (!IS_DELEGATED_BOTTOM_SHEET) {
    actions.addAccount2({ method, password });
  } else {
    callActionInMain('addAccount2', { method, password });
  }
});

addActionHandler('addAccount2', (global, actions, { method, password }) => {
  const isMnemonicImport = method === 'importMnemonic';
  const authState = isMnemonicImport ? AuthState.importWallet : AuthState.createBackup;

  global = { ...global, appState: AppState.Auth };
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
  global = updateCurrentAccountState(global, {
    landscapeActionsActiveTabIndex: index,
  });
  setGlobal(global);
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

addActionHandler('toggleTokensWithNoBalance', (global, actions, { isEnabled }) => {
  const accountId = global.currentAccountId!;
  const accountSettings = selectAccountSettings(global, accountId) ?? {};

  setGlobal(updateSettings(global, {
    areTokensWithNoBalanceHidden: isEnabled,
    byAccountId: {
      ...global.settings.byAccountId,
      [accountId]: {
        ...accountSettings,
        exceptionSlugs: [],
      },
    },
  }));
});

addActionHandler('toggleTokensWithNoPrice', (global, actions, { isEnabled }) => {
  const accountId = global.currentAccountId!;
  const accountSettings = selectAccountSettings(global, accountId) ?? {};

  setGlobal(updateSettings(global, {
    areTokensWithNoPriceHidden: isEnabled,
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

  if (!balances?.bySlug[slug]) {
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

addActionHandler('openQrScanner', (global) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('openQrScanner');
    return undefined;
  }

  return {
    ...global,
    isQrScannerOpen: true,
  };
});

addActionHandler('closeQrScanner', (global) => {
  return {
    ...global,
    isQrScannerOpen: undefined,
  };
});

addActionHandler('openDeeplink', async (global, actions, params) => {
  let { url } = params;
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('openDeeplink', { url });
    return;
  }

  if (isTonConnectDeeplink(url)) {
    void processTonConnectDeeplink(url);

    return;
  }

  if (getIsAddressValid(url)) {
    url = `ton://transfer/${url}`;
  }

  const result = await processDeeplink(url);
  if (!result) {
    actions.showNotification({
      message: 'Unrecognized QR Code',
    });
  }
});

addActionHandler('changeBaseCurrency', async (global, actions, { currency }) => {
  await callApi('setBaseCurrency', currency);
  void callApi('tryUpdateTokens');
});

addActionHandler('setIsPinAccepted', (global) => {
  return setIsPinAccepted(global);
});

addActionHandler('clearIsPinAccepted', (global) => {
  return clearIsPinAccepted(global);
});

import { AppState, HardwareConnectState } from '../../types';
import type { UserToken } from '../../types';

import { unique } from '../../../util/iteratees';
import { onLedgerTabClose, openLedgerTab } from '../../../util/ledger/tab';
import { pause } from '../../../util/schedulers';
import { callApi } from '../../../api';
import { IS_EXTENSION } from '../../../api/environment';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  renameAccount,
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
  selectCurrentAccountState, selectCurrentAccountTokens, selectDisabledSlugs, selectFirstNonHardwareAccount,
} from '../../selectors';

const OPEN_LEDGER_TAB_DELAY = 500;

addActionHandler('showTransactionInfo', (global, actions, { txId } = {}) => {
  return updateCurrentAccountState(global, { currentTransactionId: txId });
});

addActionHandler('closeTransactionInfo', (global) => {
  return updateCurrentAccountState(global, { currentTransactionId: undefined });
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
        error: 'Wrong password, please try again',
      }));
      return;
    }
  }

  global = getGlobal();
  global = updateAuth(global, { password });
  global = { ...global, isAddAccountModalOpen: undefined, appState: AppState.Auth };

  setGlobal(global);

  if (method === 'importMnemonic') {
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
  return { ...global, areSettingsOpen: true };
});

addActionHandler('closeSettings', (global) => {
  if (!global.currentAccountId) {
    return global;
  }

  return { ...global, areSettingsOpen: false };
});

addActionHandler('openBackupWalletModal', (global) => {
  return { ...global, isBackupWalletModalOpen: true };
});

addActionHandler('closeBackupWalletModal', (global) => {
  return { ...global, isBackupWalletModalOpen: undefined };
});

addActionHandler('openHardwareWalletModal', async (global, actions) => {
  const startConnection = () => {
    global = updateHardware(getGlobal(), {
      hardwareState: HardwareConnectState.Connecting,
    });
    setGlobal({ ...global, isHardwareModalOpen: true });

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
    setGlobal({ ...global, isHardwareModalOpen: true });

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

    return;
  }

  global = updateHardware(getGlobal(), {
    hardwareState: HardwareConnectState.Connect,
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
  return {
    ...global,
    landscapeActionsActiveTabIndex: index,
  };
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
  const { enabledSlugs = [] } = accountSettings;
  const updatedEnabledSlugs = isEnabled ? [] : enabledSlugs;

  setGlobal(updateSettings(global, {
    areTokensWithNoBalanceHidden: isEnabled,
    byAccountId: {
      ...global.settings.byAccountId,
      [accountId]: {
        ...accountSettings,
        enabledSlugs: updatedEnabledSlugs,
      },
    },
  }));

  actions.updateDisabledSlugs();
});

addActionHandler('toggleTokensWithNoPrice', (global, actions, { isEnabled }) => {
  const accountId = global.currentAccountId!;
  const accountSettings = selectAccountSettings(global, accountId) ?? {};
  const { enabledSlugs = [] } = accountSettings;
  const updatedEnabledSlugs = isEnabled ? [] : enabledSlugs;

  setGlobal(updateSettings(global, {
    areTokensWithNoPriceHidden: isEnabled,
    byAccountId: {
      ...global.settings.byAccountId,
      [accountId]: {
        ...accountSettings,
        enabledSlugs: updatedEnabledSlugs,
      },
    },
  }));

  actions.updateDisabledSlugs();
});

addActionHandler('toggleSortByValue', (global, actions, { isEnabled }) => {
  const accountId = global.currentAccountId!;
  const accountSettings = selectAccountSettings(global, accountId) ?? {};
  const accountToken = selectCurrentAccountTokens(global) ?? [];
  const getTotalValue = ({ price, amount }: UserToken) => price * amount;
  const updatedSlugs = accountToken
    .slice()
    .sort((a, b) => getTotalValue(b) - getTotalValue(a))
    .map(({ slug }) => slug);

  setGlobal(updateSettings(global, {
    byAccountId: {
      ...global.settings.byAccountId,
      [accountId]: {
        ...accountSettings,
        orderedSlugs: updatedSlugs,
      },
    },
    isSortByValueEnabled: isEnabled,
  }));
});

addActionHandler('initTokensOrder', (global, actions) => {
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

  actions.updateDisabledSlugs();
});

addActionHandler('updateDisabledSlugs', (global) => {
  const accountId = global.currentAccountId!;
  const accountSettings = selectAccountSettings(global, accountId) ?? {};
  const disabledSlugs = selectDisabledSlugs(
    global,
    global.settings.areTokensWithNoBalanceHidden,
    global.settings.areTokensWithNoPriceHidden,
  );

  setGlobal(updateSettings(global, {
    byAccountId: {
      ...global.settings.byAccountId,
      [accountId]: {
        ...accountSettings,
        disabledSlugs,
      },
    },
  }));
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

addActionHandler('toggleDisabledToken', (global, actions, { slug }) => {
  const accountId = global.currentAccountId!;
  const accountSettings = selectAccountSettings(global, accountId) ?? {};
  const { enabledSlugs = [], disabledSlugs = [] } = accountSettings;

  const enabledSlugsCopy = enabledSlugs.slice();
  const disabledSlugsCopy = disabledSlugs.slice();

  const slugIndexInAvailable = enabledSlugsCopy.indexOf(slug);
  const slugIndexInDisabled = disabledSlugsCopy.indexOf(slug);

  if (slugIndexInAvailable !== -1) {
    enabledSlugsCopy.splice(slugIndexInAvailable, 1);
    disabledSlugsCopy.push(slug);
  } else if (slugIndexInDisabled !== -1) {
    disabledSlugsCopy.splice(slugIndexInDisabled, 1);
    enabledSlugsCopy.push(slug);
  } else {
    enabledSlugsCopy.push(slug);
  }

  setGlobal(updateSettings(global, {
    byAccountId: {
      ...global.settings.byAccountId,
      [accountId]: {
        ...accountSettings,
        enabledSlugs: enabledSlugsCopy,
        disabledSlugs: disabledSlugsCopy,
      },
    },
  }));

  actions.updateDisabledSlugs();
});

addActionHandler('deleteToken', (global, actions, { slug }) => {
  const accountId = global.currentAccountId!;
  const { balances } = selectAccountState(global, accountId) || {};

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
  const enabledSlugs = accountSettings.enabledSlugs?.filter((s) => s !== slug);
  const disabledSlugs = accountSettings.disabledSlugs?.filter((s) => s !== slug);

  global = updateSettings(global, {
    byAccountId: {
      ...global.settings.byAccountId,
      [accountId]: {
        ...accountSettings,
        orderedSlugs,
        enabledSlugs,
        disabledSlugs,
      },
    },
  });

  setGlobal(global);
});

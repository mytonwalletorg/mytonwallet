import { AppState, HardwareConnectState } from '../../types';

import { connectLedger } from '../../../util/ledger';
import { onLedgerTabClose, openLedgerTab } from '../../../util/ledger/tab';
import { pause } from '../../../util/schedulers';
import { callApi } from '../../../api';
import { IS_EXTENSION } from '../../../api/environment';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  renameAccount,
  updateAccounts,
  updateAuth,
  updateCurrentAccountState,
  updateHardware,
} from '../../reducers';
import { selectCurrentAccountState, selectFirstNonHardwareAccount } from '../../selectors';

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

  if (await connectLedger()) {
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
    const extension = await chrome.windows.getCurrent();

    onLedgerTabClose(id, async () => {
      chrome.windows.update(extension.id!, { focused: true });

      if (!await connectLedger()) {
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

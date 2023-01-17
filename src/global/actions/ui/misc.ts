import { addActionHandler, getGlobal, setGlobal } from '../../index';

import { callApi } from '../../../api';
import {
  renameAccount,
  updateAccounts,
  updateAuth,
  updateCurrentAccountState,
} from '../../reducers';
import { selectCurrentAccountState } from '../../selectors';

addActionHandler('showTransactionInfo', (global, actions, { txId }) => {
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

addActionHandler('toggleTinyTransfersHidden', (global, actions, { isEnabled }) => {
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

addActionHandler('addAccount', async (global, actions, payload) => {
  const { isImporting, password } = payload || {};

  setGlobal(updateAccounts(global, { isLoading: true }));

  const isPasswordValid = await callApi('verifyPassword', password);
  global = getGlobal();

  if (!isPasswordValid) {
    setGlobal(updateAccounts(global, {
      isLoading: undefined,
      error: 'Wrong password, please try again',
    }));

    return;
  }

  global = updateAccounts(global, { isLoading: undefined, error: undefined });
  global = updateAuth(global, { prevAccountId: global.currentAccountId, password });
  global = { ...global, isAddAccountModalOpen: undefined, currentAccountId: undefined };

  setGlobal(global);

  if (isImporting) {
    actions.startImportingWallet();
  } else {
    actions.startCreatingWallet();
  }
});

addActionHandler('renameAccount', (global, actions, { accountId, title }) => {
  return renameAccount(global, accountId, title);
});

addActionHandler('cleanAccountError', (global) => {
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

addActionHandler('openSettingsModal', (global) => {
  return { ...global, isSettingsModalOpen: true };
});

addActionHandler('closeSettingsModal', (global) => {
  return { ...global, isSettingsModalOpen: undefined };
});

addActionHandler('toggleInvestorView', (global, actions, { isEnabled }) => {
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

addActionHandler('toggleCanPlaySounds', (global, actions, { isEnabled }) => {
  return {
    ...global,
    settings: {
      ...global.settings,
      canPlaySounds: isEnabled,
    },
  };
});

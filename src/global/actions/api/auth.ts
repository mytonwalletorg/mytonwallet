import { AppState, AuthState, HardwareConnectState } from '../../types';

import { MNEMONIC_CHECK_COUNT, MNEMONIC_COUNT } from '../../../config';
import { buildAccountId, parseAccountId } from '../../../util/account';
import { cloneDeep } from '../../../util/iteratees';
import {
  connectLedger, getFirstLedgerWallets, importLedgerWallet, waitLedgerTonApp,
} from '../../../util/ledger';
import { pause } from '../../../util/schedulers';
import { callApi } from '../../../api';
import { addActionHandler, getGlobal, setGlobal } from '../..';
import { INITIAL_STATE } from '../../initialState';
import {
  createAccount, updateAuth, updateCurrentAccountsState, updateHardware,
} from '../../reducers';
import { selectCurrentNetwork, selectFirstNonHardwareAccount, selectNewestTxIds } from '../../selectors';

const CREATING_DURATION = 3300;

addActionHandler('restartAuth', (global) => {
  if (global.currentAccountId) {
    global = { ...global, appState: AppState.Main };
  }

  global = { ...global, auth: cloneDeep(INITIAL_STATE.auth) };

  setGlobal(global);
});

addActionHandler('startCreatingWallet', async (global, actions) => {
  setGlobal(
    updateAuth(global, {
      state: AuthState.creatingWallet,
      method: 'createAccount',
      error: undefined,
    }),
  );

  const [mnemonic] = await Promise.all([callApi('generateMnemonic'), pause(CREATING_DURATION)]);

  global = updateAuth(getGlobal(), {
    mnemonic,
    mnemonicCheckIndexes: selectMnemonicForCheck(),
  });

  const firstNonHardwareAccount = selectFirstNonHardwareAccount(global);

  if (firstNonHardwareAccount) {
    setGlobal(global);
    actions.afterCreatePassword({ password: global.auth.password! });

    return;
  }

  setGlobal(updateAuth(global, { state: AuthState.createPassword }));
});

addActionHandler('afterCreatePassword', (global, actions, { password }) => {
  setGlobal(updateAuth(global, { isLoading: true }));

  const { method } = getGlobal().auth;

  const isImporting = method !== 'createAccount';
  const isHardware = method === 'importHardwareWallet';

  if (isHardware) {
    actions.createHardwareAccounts();
    return;
  }

  actions.createAccount({ password, isImporting });
});

addActionHandler('createAccount', async (global, actions, { password, isImporting }) => {
  setGlobal(updateAuth(global, { isLoading: true }));

  const network = selectCurrentNetwork(getGlobal());

  const result = await callApi(
    isImporting ? 'importMnemonic' : 'createWallet',
    network,
    global.auth.mnemonic!,
    password,
  );

  global = getGlobal();

  if (!result) {
    setGlobal(updateAuth(global, { isLoading: undefined }));
    return;
  }

  global = updateAuth(global, {
    isLoading: undefined,
    password: undefined,
  });
  const { accountId, address } = result;

  if (isImporting) {
    global = { ...global, currentAccountId: accountId };
    global = updateAuth(global, {
      state: AuthState.ready,
    });
    global = createAccount(global, accountId, address);
    setGlobal(global);

    actions.afterSignIn();
  } else {
    global = updateAuth(global, {
      state: AuthState.createBackup,
      accountId,
      address,
    });

    setGlobal(global);
  }
});

addActionHandler('createHardwareAccounts', async (global, actions) => {
  const isFirstAccount = !global.currentAccountId;
  setGlobal(updateAuth(global, { isLoading: true }));

  const { hardwareSelectedIndices = [] } = getGlobal().hardware;
  const network = selectCurrentNetwork(getGlobal());

  const wallets = await Promise.all(hardwareSelectedIndices.map((wallet) => importLedgerWallet(network, wallet)));

  const updatedGlobal = wallets.reduce((currentGlobal, wallet) => {
    if (!wallet) {
      return currentGlobal;
    }
    const { accountId, address, walletInfo } = wallet;

    currentGlobal = { ...currentGlobal, currentAccountId: accountId };
    currentGlobal = createAccount(currentGlobal, accountId, address, {
      isHardware: true,
      ...(walletInfo && {
        ledger: {
          driver: walletInfo.driver,
          index: walletInfo.index,
        },
      }),
    });

    return currentGlobal;
  }, getGlobal());

  setGlobal(updateAuth(updatedGlobal, { isLoading: false }));

  if (getGlobal().areSettingsOpen) {
    actions.closeSettings();
  }

  if (isFirstAccount) {
    actions.afterSignIn();
  }
});

addActionHandler('afterCheckMnemonic', (global, actions) => {
  global = { ...global, currentAccountId: global.auth.accountId! };
  global = updateCurrentAccountsState(global, {});
  global = createAccount(global, global.auth.accountId!, global.auth.address!);
  setGlobal(global);

  actions.afterSignIn();
});

addActionHandler('restartCheckMnemonicIndexes', (global) => {
  setGlobal(
    updateAuth(global, {
      mnemonicCheckIndexes: selectMnemonicForCheck(),
    }),
  );
});

addActionHandler('skipCheckMnemonic', (global, actions) => {
  global = { ...global, currentAccountId: global.auth.accountId! };
  global = updateCurrentAccountsState(global, {
    isBackupRequired: true,
  });
  global = createAccount(global, global.auth.accountId!, global.auth.address!);
  setGlobal(global);

  actions.afterSignIn();
});

addActionHandler('startImportingWallet', (global) => {
  setGlobal(
    updateAuth(global, {
      state: AuthState.importWallet,
      error: undefined,
      method: 'importMnemonic',
    }),
  );
});

addActionHandler('openAbout', (global) => {
  setGlobal(updateAuth(global, { state: AuthState.about, error: undefined }));
});

addActionHandler('closeAbout', (global) => {
  setGlobal(updateAuth(global, { state: AuthState.none, error: undefined }));
});

addActionHandler('afterImportMnemonic', async (global, actions, { mnemonic }) => {
  const isValid = await callApi('validateMnemonic', mnemonic);
  if (!isValid) {
    setGlobal(
      updateAuth(getGlobal(), {
        error: 'Your mnemonic words are invalid.',
      }),
    );

    return;
  }

  global = updateAuth(getGlobal(), {
    mnemonic,
    error: undefined,
  });

  const firstNonHardwareAccount = selectFirstNonHardwareAccount(global);

  if (firstNonHardwareAccount) {
    setGlobal(global);
    actions.afterCreatePassword({ password: global.auth.password! });

    return;
  }

  setGlobal(updateAuth(global, { state: AuthState.importWalletCreatePassword }));
});

addActionHandler('cleanAuthError', (global) => {
  setGlobal(updateAuth(global, { error: undefined }));
});

export function selectMnemonicForCheck() {
  return Array(MNEMONIC_COUNT)
    .fill(0)
    .map((_, i) => ({ i, rnd: Math.random() }))
    .sort((a, b) => a.rnd - b.rnd)
    .map((i) => i.i)
    .slice(0, MNEMONIC_CHECK_COUNT)
    .sort((a, b) => a - b);
}

addActionHandler('startChangingNetwork', (global, actions, { network }) => {
  const accountId = buildAccountId({
    ...parseAccountId(global.currentAccountId!),
    network,
  });

  actions.switchAccount({ accountId, newNetwork: network });
});

addActionHandler('switchAccount', async (global, actions, { accountId, newNetwork }) => {
  const newestTxIds = selectNewestTxIds(global, accountId);
  await callApi('activateAccount', accountId, newestTxIds);

  setGlobal({
    ...getGlobal(),
    currentAccountId: accountId,
  });

  if (newNetwork) {
    actions.changeNetwork({ network: newNetwork });
  }
});

addActionHandler('connectHardwareWallet', async (global) => {
  setGlobal(
    updateHardware(global, {
      hardwareState: HardwareConnectState.Connecting,
      hardwareWallets: undefined,
      hardwareSelectedIndices: undefined,
      isLedgerConnected: undefined,
      isTonAppConnected: undefined,
    }),
  );

  const isLedgerConnected = await connectLedger();
  if (!isLedgerConnected) {
    setGlobal(
      updateHardware(getGlobal(), {
        isLedgerConnected: false,
        hardwareState: HardwareConnectState.Failed,
      }),
    );
    return;
  }

  setGlobal(
    updateHardware(getGlobal(), {
      isLedgerConnected: true,
    }),
  );

  const isTonAppConnected = await waitLedgerTonApp();

  if (!isTonAppConnected) {
    setGlobal(
      updateHardware(getGlobal(), {
        isTonAppConnected: false,
        hardwareState: HardwareConnectState.Failed,
      }),
    );
    return;
  }

  setGlobal(
    updateHardware(getGlobal(), {
      isTonAppConnected: true,
    }),
  );

  try {
    const network = selectCurrentNetwork(getGlobal());
    const hardwareWallets = await getFirstLedgerWallets(network);

    setGlobal(
      updateHardware(getGlobal(), {
        hardwareWallets,
        hardwareState: HardwareConnectState.Connected,
      }),
    );
  } catch (err) {
    setGlobal(
      updateHardware(getGlobal(), {
        hardwareState: HardwareConnectState.Failed,
      }),
    );
  }
});

addActionHandler('afterSelectHardwareWallets', (global, actions, { hardwareSelectedIndices }) => {
  global = updateAuth(getGlobal(), {
    method: 'importHardwareWallet',
    error: undefined,
  });

  global = updateHardware(global, {
    hardwareSelectedIndices,
  });

  setGlobal(global);
  actions.afterCreatePassword({ password: '' });
});

addActionHandler('resetHardwareWalletConnect', (global) => {
  setGlobal(
    updateHardware(global, {
      hardwareState: HardwareConnectState.Connect,
      isLedgerConnected: undefined,
      isTonAppConnected: undefined,
    }),
  );
});

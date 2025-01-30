import { NativeBiometric } from '@capgo/capacitor-native-biometric';

import type { ApiChain, ApiNetwork } from '../../../api/types';
import type { GlobalState } from '../../types';
import { ApiAuthError, ApiCommonError } from '../../../api/types';
import {
  AppState, AuthState, BiometricsState, HardwareConnectState,
} from '../../types';

import {
  APP_NAME, IS_CAPACITOR, MNEMONIC_CHECK_COUNT, MNEMONIC_COUNT,
} from '../../../config';
import { parseAccountId } from '../../../util/account';
import authApi from '../../../util/authApi';
import webAuthn from '../../../util/authApi/webAuthn';
import { getIsNativeBiometricAuthSupported, vibrateOnError, vibrateOnSuccess } from '../../../util/capacitor';
import { copyTextToClipboard } from '../../../util/clipboard';
import isMnemonicPrivateKey from '../../../util/isMnemonicPrivateKey';
import { cloneDeep, compact, omitUndefined } from '../../../util/iteratees';
import { getTranslation } from '../../../util/langProvider';
import { isLedgerConnectionBroken } from '../../../util/ledger/utils';
import { logDebugError } from '../../../util/logs';
import { callActionInMain } from '../../../util/multitab';
import { clearPoisoningCache } from '../../../util/poisoningHash';
import { pause } from '../../../util/schedulers';
import {
  IS_BIOMETRIC_AUTH_SUPPORTED,
  IS_DELEGATED_BOTTOM_SHEET,
  IS_DELEGATING_BOTTOM_SHEET,
  IS_ELECTRON,
} from '../../../util/windowEnvironment';
import { callApi } from '../../../api';
import {
  addActionHandler, getActions, getGlobal, setGlobal,
} from '../..';
import { INITIAL_STATE } from '../../initialState';
import {
  clearIsPinAccepted,
  createAccount,
  setIsPinAccepted,
  switchAccountAndClearGlobal,
  updateAuth,
  updateBiometrics,
  updateCurrentAccountId,
  updateCurrentAccountState,
  updateHardware,
  updateSettings,
} from '../../reducers';
import {
  selectAccountIdByAddress,
  selectAccounts,
  selectAllHardwareAccounts,
  selectCurrentNetwork,
  selectFirstNonHardwareAccount,
  selectIsOneAccount,
  selectLedgerAccountIndexToImport,
  selectNetworkAccountsMemoized,
  selectNewestTxTimestamps,
} from '../../selectors';

const CREATING_DURATION = 3300;
const NATIVE_BIOMETRICS_PAUSE_MS = 750;

export async function switchAccount(global: GlobalState, accountId: string, newNetwork?: ApiNetwork) {
  if (accountId === global.currentAccountId) {
    return;
  }

  const actions = getActions();

  const newestTxTimestamps = selectNewestTxTimestamps(global, accountId);
  await callApi('activateAccount', accountId, newestTxTimestamps);

  global = getGlobal();
  setGlobal(switchAccountAndClearGlobal(global, accountId));

  actions.clearSwapPairsCache();
  clearPoisoningCache();

  if (newNetwork) {
    actions.changeNetwork({ network: newNetwork });
  }
}

addActionHandler('resetAuth', (global) => {
  if (global.currentAccountId) {
    global = { ...global, appState: AppState.Main };

    // Restore the network when refreshing the page during the switching networks
    global = updateSettings(global, {
      isTestnet: parseAccountId(global.currentAccountId!).network === 'testnet',
    });
  }

  global = { ...global, auth: cloneDeep(INITIAL_STATE.auth) };

  setGlobal(global);
});

addActionHandler('startCreatingWallet', async (global, actions) => {
  const accounts = selectAccounts(global) ?? {};
  const isFirstAccount = !Object.values(accounts).length;
  const firstNonHardwareAccount = selectFirstNonHardwareAccount(global);
  const nextAuthState = firstNonHardwareAccount
    ? AuthState.createBackup
    : (isFirstAccount
      ? AuthState.createWallet
      // The app only has hardware wallets accounts, which means we need to create a password or biometrics
      : IS_CAPACITOR
        ? AuthState.createPin
        : (IS_BIOMETRIC_AUTH_SUPPORTED ? AuthState.createBiometrics : AuthState.createPassword)
    );

  global = getGlobal();

  if (Boolean(firstNonHardwareAccount) && !global.auth.password) {
    setGlobal(updateAuth(global, {
      state: AuthState.checkPassword,
      error: undefined,
    }));
    return;
  }

  const promiseCalls = [
    callApi('generateMnemonic'),
    ...(!firstNonHardwareAccount ? [pause(CREATING_DURATION)] : []),
  ] as [Promise<Promise<string[]> | undefined>, Promise<void> | undefined];

  setGlobal(
    updateAuth(global, {
      state: nextAuthState,
      method: 'createAccount',
      error: undefined,
    }),
  );

  const [mnemonic] = await Promise.all(promiseCalls);

  global = updateAuth(getGlobal(), {
    mnemonic,
    mnemonicCheckIndexes: selectMnemonicForCheck(mnemonic?.length ?? MNEMONIC_COUNT),
  });

  if (firstNonHardwareAccount) {
    setGlobal(global);
    actions.afterCreatePassword({ password: global.auth.password! });

    return;
  }

  setGlobal(updateAuth(global, {
    state: IS_CAPACITOR
      ? AuthState.createPin
      : (IS_BIOMETRIC_AUTH_SUPPORTED ? AuthState.createBiometrics : AuthState.createPassword),
  }));

  if (isFirstAccount) {
    actions.requestConfetti();
    if (IS_CAPACITOR) {
      void vibrateOnSuccess();
    }
  }
});

addActionHandler('startCreatingBiometrics', (global) => {
  global = updateAuth(global, {
    state: global.auth.method !== 'createAccount'
      ? AuthState.importWalletConfirmBiometrics
      : AuthState.confirmBiometrics,
    biometricsStep: 1,
  });
  setGlobal(global);
});

addActionHandler('cancelCreateBiometrics', (global) => {
  global = updateAuth(global, {
    state: AuthState.createBiometrics,
    biometricsStep: undefined,
  });
  setGlobal(global);
});

addActionHandler('createPin', (global, actions, { pin, isImporting }) => {
  global = updateAuth(global, {
    state: isImporting ? AuthState.importWalletConfirmPin : AuthState.confirmPin,
    password: pin,
  });
  setGlobal(global);
});

addActionHandler('confirmPin', (global, actions, { isImporting }) => {
  if (getIsNativeBiometricAuthSupported()) {
    global = updateAuth(global, {
      state: isImporting ? AuthState.importWalletCreateNativeBiometrics : AuthState.createNativeBiometrics,
    });
    setGlobal(global);
  } else {
    actions.skipCreateNativeBiometrics();
  }
});

addActionHandler('cancelConfirmPin', (global, actions, { isImporting }) => {
  global = updateAuth(global, {
    state: isImporting ? AuthState.importWalletCreatePin : AuthState.createPin,
  });
  setGlobal(global);
});

addActionHandler('cancelDisclaimer', (global) => {
  setGlobal(updateAuth(global, {
    state: IS_CAPACITOR
      ? AuthState.createPin
      : (IS_BIOMETRIC_AUTH_SUPPORTED ? AuthState.createBiometrics : AuthState.createPassword),
  }));
});

addActionHandler('afterCreatePassword', (global, actions, { password, isPasswordNumeric }) => {
  setGlobal(updateAuth(global, { isLoading: true }));

  const { method } = getGlobal().auth;

  const isImporting = method !== 'createAccount';
  const isHardware = method === 'importHardwareWallet';

  if (isHardware) {
    actions.createHardwareAccounts();
    return;
  }

  actions.createAccount({ password, isImporting, isPasswordNumeric });
});

addActionHandler('afterCreateBiometrics', async (global, actions) => {
  const withCredential = !IS_ELECTRON;
  global = updateAuth(global, {
    isLoading: true,
    error: undefined,
    biometricsStep: withCredential ? 1 : undefined,
  });
  setGlobal(global);

  try {
    const credential = withCredential
      ? await webAuthn.createCredential()
      : undefined;
    global = getGlobal();
    global = updateAuth(global, { biometricsStep: withCredential ? 2 : undefined });
    setGlobal(global);
    const result = await authApi.setupBiometrics({ credential });

    global = getGlobal();
    global = updateAuth(global, {
      isLoading: false,
      biometricsStep: undefined,
    });

    if (!result) {
      global = updateAuth(global, { error: 'Biometric setup failed.' });
      setGlobal(global);

      return;
    }

    global = updateSettings(global, { authConfig: result.config });
    setGlobal(global);

    actions.afterCreatePassword({ password: result.password });
  } catch (err: any) {
    const error = err?.message.includes('privacy-considerations-client')
      ? 'Biometric setup failed.'
      : (err?.message || 'Biometric setup failed.');
    global = getGlobal();
    global = updateAuth(global, {
      isLoading: false,
      error,
      biometricsStep: undefined,
    });
    setGlobal(global);
  }
});

addActionHandler('skipCreateBiometrics', (global) => {
  global = updateAuth(global, { state: AuthState.createPassword });
  setGlobal(global);
});

addActionHandler('afterCreateNativeBiometrics', async (global, actions) => {
  global = updateAuth(global, {
    isLoading: true,
    error: undefined,
  });
  setGlobal(global);

  try {
    const { password } = global.auth;
    const result = await authApi.setupNativeBiometrics(password!);

    global = getGlobal();
    global = updateAuth(global, { isLoading: false });
    global = updateSettings(global, { authConfig: result.config });
    setGlobal(global);

    actions.afterCreatePassword({ password: password!, isPasswordNumeric: true });
  } catch (err: any) {
    const error = err?.message.includes('privacy-considerations-client')
      ? 'Biometric setup failed.'
      : (err?.message || 'Biometric setup failed.');
    global = getGlobal();
    global = updateAuth(global, {
      isLoading: false,
      error,
    });
    setGlobal(global);
  }
});

addActionHandler('skipCreateNativeBiometrics', (global, actions) => {
  const { password } = global.auth;

  global = updateAuth(global, { isLoading: false, error: undefined });
  global = updateSettings(global, {
    authConfig: { kind: 'password' },
    isPasswordNumeric: true,
  });
  setGlobal(global);

  actions.afterCreatePassword({ password: password!, isPasswordNumeric: true });
});

addActionHandler('createAccount', async (global, actions, {
  password, isImporting, isPasswordNumeric, version,
}) => {
  setGlobal(updateAuth(global, { isLoading: true }));

  const network = selectCurrentNetwork(getGlobal());

  const result = await callApi(
    isImporting ? 'importMnemonic' : 'createWallet',
    network,
    global.auth.mnemonic!,
    password,
    version,
  );

  global = getGlobal();

  if (!result || 'error' in result) {
    setGlobal(updateAuth(global, { isLoading: undefined }));
    actions.showError({ error: result?.error });
    return;
  }

  const { accountId, tonAddress, tronAddress } = result;

  const addressByChain = omitUndefined({
    ton: tonAddress,
    tron: tronAddress,
  }) as Record<ApiChain, string>;

  if (!isImporting) {
    global = { ...global, appState: AppState.Auth, isAddAccountModalOpen: undefined };
  }
  global = updateAuth(global, {
    addressByChain,
    accountId,
    isLoading: undefined,
    password: undefined,
    ...(isPasswordNumeric && { isPasswordNumeric: true }),
  });
  global = clearIsPinAccepted(global);

  if (isImporting) {
    const hasAccounts = Object.keys(selectAccounts(global) || {}).length > 0;
    if (hasAccounts) {
      setGlobal(global);
      actions.afterConfirmDisclaimer();

      return;
    } else {
      global = updateAuth(global, { state: AuthState.disclaimer });
    }
  } else {
    const accounts = selectAccounts(global) ?? {};
    const isFirstAccount = !Object.values(accounts).length;
    global = updateAuth(global, {
      state: isFirstAccount ? AuthState.disclaimerAndBackup : AuthState.createBackup,
    });
  }

  setGlobal(global);
});

addActionHandler('createHardwareAccounts', async (global, actions) => {
  const accounts = selectAccounts(global) ?? {};
  const isFirstAccount = !Object.values(accounts).length;

  setGlobal(updateAuth(global, { isLoading: true }));

  const { hardwareSelectedIndices = [] } = getGlobal().hardware;
  const network = selectCurrentNetwork(getGlobal());

  const ledgerApi = await import('../../../util/ledger');
  const wallets = await Promise.all(
    hardwareSelectedIndices.map(
      (wallet) => ledgerApi.importLedgerWallet(network, wallet),
    ),
  );

  if (IS_DELEGATED_BOTTOM_SHEET && !isFirstAccount) {
    callActionInMain('addHardwareAccounts', { wallets });
    return;
  }

  actions.addHardwareAccounts({ wallets });
});

addActionHandler('addHardwareAccounts', (global, actions, { wallets }) => {
  const isFirstAccount = !global.currentAccountId;
  const nextActiveAccountId = wallets[0]?.accountId;
  if (nextActiveAccountId) {
    void callApi('activateAccount', nextActiveAccountId);
  }

  const updatedGlobal = wallets.reduce((currentGlobal, wallet) => {
    if (!wallet) {
      return currentGlobal;
    }
    const { accountId, address, walletInfo } = wallet;
    const addressByChain = { ton: address } as Record<ApiChain, string>;

    currentGlobal = updateCurrentAccountId(currentGlobal, accountId);
    currentGlobal = createAccount(currentGlobal, accountId, addressByChain, {
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

  if (nextActiveAccountId) {
    global = updateCurrentAccountId(updatedGlobal, nextActiveAccountId);
  }
  global = updateAuth(global, { isLoading: false });
  global = {
    ...global,
    shouldForceAccountEdit: true,
  };
  setGlobal(global);

  if (getGlobal().areSettingsOpen) {
    actions.closeSettings();
  }

  wallets.forEach((hardwareWallet) => {
    if (hardwareWallet?.accountId) {
      actions.tryAddNotificationAccount({ accountId: hardwareWallet?.accountId });
    }
  });

  actions.afterSignIn();
  if (isFirstAccount) {
    actions.resetApiSettings();
    actions.requestConfetti();

    if (IS_CAPACITOR) {
      void vibrateOnSuccess();
    }
  }
});

addActionHandler('afterCheckMnemonic', (global, actions) => {
  global = updateCurrentAccountId(global, global.auth.accountId!);
  global = updateCurrentAccountState(global, {});
  global = createAccount(global, global.auth.accountId!, global.auth.addressByChain!);
  setGlobal(global);

  actions.tryAddNotificationAccount({ accountId: global.auth.accountId! });

  actions.afterSignIn();
  if (selectIsOneAccount(global)) {
    actions.resetApiSettings();
  }
});

addActionHandler('restartCheckMnemonicIndexes', (global, actions, { worldsCount }) => {
  setGlobal(
    updateAuth(global, {
      mnemonicCheckIndexes: selectMnemonicForCheck(worldsCount),
    }),
  );
});

addActionHandler('skipCheckMnemonic', (global, actions) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('skipCheckMnemonic');
    return;
  }

  global = updateCurrentAccountId(global, global.auth.accountId!);
  global = updateCurrentAccountState(global, {
    isBackupRequired: true,
  });
  global = createAccount(global, global.auth.accountId!, global.auth.addressByChain!);

  actions.tryAddNotificationAccount({ accountId: global.auth.accountId! });

  setGlobal(global);

  actions.afterSignIn();
  if (selectIsOneAccount(global)) {
    actions.resetApiSettings();
  }
});

addActionHandler('startImportingWallet', (global) => {
  const firstNonHardwareAccount = selectFirstNonHardwareAccount(global);
  const state = firstNonHardwareAccount && !global.auth.password
    ? AuthState.importWalletCheckPassword
    : AuthState.importWallet;

  setGlobal(
    updateAuth(global, {
      state,
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
  mnemonic = compact(mnemonic);

  if (!isMnemonicPrivateKey(mnemonic)) {
    if (!await callApi('validateMnemonic', mnemonic)) {
      setGlobal(updateAuth(getGlobal(), {
        error: ApiAuthError.InvalidMnemonic,
      }));

      return;
    }
  }

  global = getGlobal();

  const firstNonHardwareAccount = selectFirstNonHardwareAccount(global);
  const hasAccounts = Object.keys(selectAccounts(global) || {}).length > 0;
  const state = IS_CAPACITOR
    ? AuthState.importWalletCreatePin
    : (IS_BIOMETRIC_AUTH_SUPPORTED
      ? AuthState.importWalletCreateBiometrics
      : AuthState.importWalletCreatePassword);

  global = updateAuth(global, {
    mnemonic,
    error: undefined,
    ...(!firstNonHardwareAccount && { state }),
  });
  setGlobal(global);

  if (!firstNonHardwareAccount) {
    if (!hasAccounts) {
      actions.requestConfetti();
    }

    if (IS_CAPACITOR) {
      void vibrateOnSuccess();
    }
  } else {
    actions.confirmDisclaimer();
  }
});

addActionHandler('confirmDisclaimer', (global, actions) => {
  const firstNonHardwareAccount = selectFirstNonHardwareAccount(global);

  if (firstNonHardwareAccount) {
    setGlobal(global);
    actions.afterCreatePassword({ password: global.auth.password! });

    return;
  }

  actions.afterConfirmDisclaimer();
});

addActionHandler('afterConfirmDisclaimer', (global, actions) => {
  const { accountId, addressByChain } = global.auth;

  global = updateCurrentAccountId(global, accountId!);
  global = updateAuth(global, { state: AuthState.ready });
  global = createAccount(global, accountId!, addressByChain!);
  setGlobal(global);

  actions.tryAddNotificationAccount({ accountId: accountId! });

  actions.afterSignIn();
  if (selectIsOneAccount(global)) {
    actions.resetApiSettings();
  }
});

addActionHandler('cleanAuthError', (global) => {
  setGlobal(updateAuth(global, { error: undefined }));
});

export function selectMnemonicForCheck(worldsCount: number) {
  return Array(worldsCount)
    .fill(0)
    .map((_, i) => ({ i, rnd: Math.random() }))
    .sort((a, b) => a.rnd - b.rnd)
    .map((i) => i.i)
    .slice(0, Math.min(MNEMONIC_CHECK_COUNT, worldsCount))
    .sort((a, b) => a - b);
}

addActionHandler('startChangingNetwork', (global, actions, { network }) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('startChangingNetwork', { network });
  }

  const accountIds = Object.keys(selectNetworkAccountsMemoized(network, global.accounts!.byId)!);

  if (accountIds.length) {
    const accountId = accountIds[0];
    actions.switchAccount({ accountId, newNetwork: network });
  } else {
    setGlobal({
      ...global,
      areSettingsOpen: false,
      appState: AppState.Auth,
    });
    actions.changeNetwork({ network });
  }
});

addActionHandler('switchAccount', async (global, actions, payload) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('switchAccount', payload);
    return;
  }

  const { accountId, newNetwork } = payload;
  await switchAccount(global, accountId, newNetwork);
});

addActionHandler('connectHardwareWallet', async (global, actions, params) => {
  const accounts = selectAccounts(global) ?? {};
  const isFirstAccount = !Object.values(accounts).length;
  const { areSettingsOpen } = global;

  if (IS_DELEGATING_BOTTOM_SHEET && !isFirstAccount && !areSettingsOpen) return;

  global = updateHardware(global, {
    hardwareState: HardwareConnectState.Connecting,
    hardwareWallets: undefined,
    hardwareSelectedIndices: undefined,
    isLedgerConnected: undefined,
    isTonAppConnected: undefined,
  });
  setGlobal(global);

  const ledgerApi = await import('../../../util/ledger');

  const isLedgerConnected = await ledgerApi.connectLedger(params.transport);
  global = getGlobal();

  if (!isLedgerConnected) {
    global = updateHardware(global, {
      isLedgerConnected: false,
      hardwareState: HardwareConnectState.Failed,
    });
    setGlobal(global);
    return;
  }

  global = updateHardware(global, {
    isLedgerConnected: true,
  });
  setGlobal(global);

  try {
    const isTonAppConnected = await ledgerApi.waitLedgerTonApp();
    global = getGlobal();

    if (!isTonAppConnected) {
      global = updateHardware(global, {
        isTonAppConnected: false,
        hardwareState: HardwareConnectState.Failed,
      });
      setGlobal(global);
      return;
    }

    global = updateHardware(global, {
      isTonAppConnected: true,
    });
    setGlobal(global);

    global = getGlobal();
    const { isRemoteTab } = global.hardware;
    const network = selectCurrentNetwork(global);
    const lastIndex = selectLedgerAccountIndexToImport(global);
    const currentHardwareAccounts = selectAllHardwareAccounts(global) ?? [];
    const currentHardwareAddresses = currentHardwareAccounts.map((account) => account.addressByChain.ton);
    const hardwareWallets = isRemoteTab ? [] : await ledgerApi.getNextLedgerWallets(
      network,
      lastIndex,
      currentHardwareAddresses,
    );

    global = getGlobal();

    if ('error' in hardwareWallets) {
      actions.showError({ error: hardwareWallets.error });
      throw Error(hardwareWallets.error);
    }

    const nextHardwareState = isRemoteTab || hardwareWallets.length === 1
      ? HardwareConnectState.ConnectedWithSingleWallet
      : HardwareConnectState.ConnectedWithSeveralWallets;

    global = updateHardware(global, {
      hardwareWallets,
      hardwareState: nextHardwareState,
      lastUsedTransport: params.transport,
    });
    setGlobal(global);
  } catch (err: any) {
    const isLedgerDisconnected = isLedgerConnectionBroken(err.name);

    if (isLedgerDisconnected && !params.noRetry) {
      actions.connectHardwareWallet({ ...params, noRetry: true });
      return;
    }

    global = getGlobal();
    global = updateHardware(global, {
      isLedgerConnected: !isLedgerDisconnected,
      isTonAppConnected: isLedgerDisconnected ? undefined : global.hardware.isTonAppConnected,
      hardwareState: HardwareConnectState.Failed,
    });
    setGlobal(global);

    logDebugError('connectHardwareWallet', err);
  }
});

addActionHandler('loadMoreHardwareWallets', async (global, actions, { lastIndex }) => {
  const network = selectCurrentNetwork(global);
  const oldHardwareWallets = global.hardware.hardwareWallets ?? [];
  const ledgerApi = await import('../../../util/ledger');
  const hardwareWallets = await ledgerApi.getNextLedgerWallets(network, lastIndex);

  global = getGlobal();

  if ('error' in hardwareWallets) {
    actions.showError({ error: hardwareWallets.error });
    throw Error(hardwareWallets.error);
  }

  global = updateHardware(global, {
    hardwareWallets: oldHardwareWallets.concat(hardwareWallets),
  });
  setGlobal(global);
});

addActionHandler('afterSelectHardwareWallets', (global, actions, { hardwareSelectedIndices }) => {
  global = updateAuth(global, {
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
  global = updateHardware(global, {
    hardwareState: HardwareConnectState.Connect,
    isLedgerConnected: undefined,
    isTonAppConnected: undefined,
  });
  setGlobal(global);
});

addActionHandler('enableBiometrics', async (global, actions, { password }) => {
  if (!(await callApi('verifyPassword', password))) {
    global = getGlobal();
    global = updateBiometrics(global, { error: 'Wrong password, please try again.' });
    setGlobal(global);

    return;
  }

  global = getGlobal();
  global = updateBiometrics(global, {
    error: undefined,
    state: BiometricsState.TurnOnRegistration,
  });
  global = updateAuth(global, { isLoading: true });
  setGlobal(global);

  try {
    const credential = IS_ELECTRON
      ? undefined
      : await webAuthn.createCredential();

    global = getGlobal();
    global = updateBiometrics(global, { state: BiometricsState.TurnOnVerification });
    setGlobal(global);

    const result = await authApi.setupBiometrics({ credential });

    global = getGlobal();
    if (!result) {
      global = updateBiometrics(global, {
        error: 'Biometric setup failed.',
        state: BiometricsState.TurnOnPasswordConfirmation,
      });
      setGlobal(global);

      return;
    }
    global = updateBiometrics(global, { state: BiometricsState.TurnOnComplete });
    setGlobal(global);

    await callApi('changePassword', password, result.password);

    global = getGlobal();
    global = updateSettings(global, { authConfig: result.config });

    setGlobal(global);
  } catch (err: any) {
    const error = err?.message.includes('privacy-considerations-client')
      ? 'Biometric setup failed.'
      : (err?.message || 'Biometric setup failed.');
    global = getGlobal();
    global = updateBiometrics(global, {
      error,
      state: BiometricsState.TurnOnPasswordConfirmation,
    });
    setGlobal(global);
  } finally {
    global = getGlobal();
    global = updateAuth(global, { isLoading: undefined });
    setGlobal(global);
  }
});

addActionHandler('disableBiometrics', async (global, actions, { password, isPasswordNumeric }) => {
  const { password: oldPassword } = global.biometrics;

  if (!password || !oldPassword) {
    global = updateBiometrics(global, { error: 'Biometric confirmation failed.' });
    setGlobal(global);

    return;
  }

  global = getGlobal();
  global = updateAuth(global, { isLoading: true });
  setGlobal(global);

  try {
    await callApi('changePassword', oldPassword, password);
  } catch (err: any) {
    global = getGlobal();
    global = updateBiometrics(global, { error: err?.message || 'Failed to disable biometrics.' });
    setGlobal(global);

    return;
  } finally {
    global = getGlobal();
    global = updateAuth(global, { isLoading: undefined });
    setGlobal(global);
  }

  global = getGlobal();
  global = updateBiometrics(global, {
    state: BiometricsState.TurnOffComplete,
    error: undefined,
  });
  global = updateSettings(global, {
    authConfig: { kind: 'password' },
    isPasswordNumeric,
  });
  setGlobal(global);
});

addActionHandler('closeBiometricSettings', (global) => {
  global = { ...global, biometrics: cloneDeep(INITIAL_STATE.biometrics) };

  setGlobal(global);
});

addActionHandler('openBiometricsTurnOn', (global) => {
  global = updateBiometrics(global, { state: BiometricsState.TurnOnPasswordConfirmation });

  setGlobal(global);
});

addActionHandler('openBiometricsTurnOffWarning', (global) => {
  global = updateBiometrics(global, { state: BiometricsState.TurnOffWarning });

  setGlobal(global);
});

addActionHandler('openBiometricsTurnOff', async (global) => {
  global = updateBiometrics(global, { state: BiometricsState.TurnOffBiometricConfirmation });
  setGlobal(global);

  const password = await authApi.getPassword(global.settings.authConfig!);
  global = getGlobal();

  if (!password) {
    global = updateBiometrics(global, { error: 'Biometric confirmation failed.' });
  } else {
    global = updateBiometrics(global, {
      state: BiometricsState.TurnOffCreatePassword,
      password,
    });
  }

  setGlobal(global);
});

addActionHandler('disableNativeBiometrics', (global) => {
  global = updateSettings(global, {
    authConfig: { kind: 'password' },
    isPasswordNumeric: true,
  });
  setGlobal(global);
});

addActionHandler('enableNativeBiometrics', async (global, actions, { password }) => {
  if (!(await callApi('verifyPassword', password))) {
    global = getGlobal();
    global = {
      ...global,
      nativeBiometricsError: 'Incorrect code, please try again.',
    };
    global = clearIsPinAccepted(global);
    setGlobal(global);

    return;
  }

  global = getGlobal();

  global = setIsPinAccepted(global);
  global = {
    ...global,
    nativeBiometricsError: undefined,
  };
  setGlobal(global);

  try {
    const isVerified = await NativeBiometric.verifyIdentity({
      title: APP_NAME,
      subtitle: '',
      maxAttempts: 1,
    })
      .then(() => true)
      .catch(() => false);

    if (!isVerified) {
      global = getGlobal();
      global = {
        ...global,
        nativeBiometricsError: 'Failed to enable biometrics.',
      };
      global = clearIsPinAccepted(global);
      setGlobal(global);
      void vibrateOnError();

      return;
    }

    const result = await authApi.setupNativeBiometrics(password);
    await pause(NATIVE_BIOMETRICS_PAUSE_MS);

    global = getGlobal();
    global = updateSettings(global, {
      authConfig: result.config,
    });
    global = {
      ...global,
      nativeBiometricsError: undefined,
    };
    setGlobal(global);

    void vibrateOnSuccess();
  } catch (err: any) {
    global = getGlobal();
    global = {
      ...global,
      nativeBiometricsError: err?.message || 'Failed to enable biometrics.',
    };
    global = clearIsPinAccepted(global);
    setGlobal(global);

    void vibrateOnError();
  }
});

addActionHandler('clearNativeBiometricsError', (global) => {
  return {
    ...global,
    nativeBiometricsError: undefined,
  };
});

addActionHandler('openAuthBackupWalletModal', (global) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('openAuthBackupWalletModal');
    return;
  }

  global = updateAuth(global, { state: AuthState.saferyRules });
  setGlobal(global);
});

addActionHandler('openMnemonicPage', (global) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('openMnemonicPage');
    return;
  }

  global = updateAuth(global, { state: AuthState.mnemonicPage });
  setGlobal(global);
});

addActionHandler('openCreateBackUpPage', (global) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('openCreateBackUpPage');
    return;
  }

  const accounts = selectAccounts(global) ?? {};

  const isFirstAccount = !Object.values(accounts).length;
  global = updateAuth(global, {
    state: isFirstAccount ? AuthState.disclaimerAndBackup : AuthState.createBackup,
  });

  setGlobal(global);
});

addActionHandler('openCheckWordsPage', (global) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('openCheckWordsPage');
    return;
  }

  global = updateAuth(global, { state: AuthState.checkWords });
  setGlobal(global);
});

addActionHandler('closeCheckWordsPage', (global, actions, props) => {
  const { isBackupCreated } = props || {};

  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('closeCheckWordsPage', props);
  }

  if (!IS_DELEGATED_BOTTOM_SHEET && isBackupCreated) {
    actions.afterCheckMnemonic();
  }
});

addActionHandler('copyStorageData', async (global, actions) => {
  const accountConfigJson = await callApi('fetchAccountConfigForDebugPurposesOnly');

  if (accountConfigJson) {
    const storageData = JSON.stringify({
      ...JSON.parse(accountConfigJson),
      global: reduceGlobalForDebug(),
    });

    await copyTextToClipboard(storageData);

    actions.showNotification({ message: getTranslation('Copied') });
  } else {
    actions.showError({ error: ApiCommonError.Unexpected });
  }
});

addActionHandler('importAccountByVersion', async (global, actions, { version }) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('importAccountByVersion', { version });
    return;
  }

  const accountId = global.currentAccountId!;

  const wallet = await callApi('importNewWalletVersion', accountId, version);
  global = getGlobal();

  const existAccountId = selectAccountIdByAddress(global, 'ton', wallet!.address);

  if (existAccountId) {
    actions.switchAccount({ accountId: existAccountId });
    return;
  }

  const { title: currentWalletTitle } = (global.accounts?.byId ?? {})[accountId];
  const addressByChain = { ton: wallet!.address } as Record<ApiChain, string>;
  global = updateCurrentAccountId(global, wallet!.accountId);

  const ledgerInfo = wallet!.ledger ? {
    isHardware: true,
    ledger: wallet?.ledger,
  } : undefined;

  global = createAccount(global, wallet!.accountId, addressByChain, {
    ...ledgerInfo,
    title: currentWalletTitle,
  }, version);

  setGlobal(global);

  await callApi('activateAccount', wallet!.accountId);

  actions.tryAddNotificationAccount({ accountId: wallet!.accountId });
});

addActionHandler('setIsAuthLoading', (global, actions, { isLoading }) => {
  global = updateAuth(global, { isLoading });
  setGlobal(global);
});

function reduceGlobalForDebug() {
  const reduced = cloneDeep(getGlobal());

  reduced.tokenInfo = {} as any;
  reduced.swapTokenInfo = {} as any;
  Object.entries(reduced.byAccountId).forEach(([, state]) => {
    state.activities = {} as any;
  });

  return reduced;
}

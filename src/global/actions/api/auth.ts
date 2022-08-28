import { AuthState } from '../../types';
import { callApi } from '../../../api';
import { addActionHandler, getGlobal, setGlobal } from '../..';
import { pause } from '../../../util/schedulers';
import { MAIN_ACCOUNT_ID, MNEMONIC_CHECK_COUNT, MNEMONIC_COUNT } from '../../../config';
import { updateAddress, updateAuth } from '../../reducers';

const CREATING_DURATION = 3300;

addActionHandler('restartAuth', (global) => {
  setGlobal(updateAuth(global, { state: AuthState.none }));
});

addActionHandler('startCreatingWallet', async (global) => {
  setGlobal(updateAuth(global, { state: AuthState.creatingWallet, error: undefined }));

  const [mnemonic] = await Promise.all([
    callApi('generateMnemonic'),
    pause(CREATING_DURATION),
  ]);

  setGlobal(updateAuth(getGlobal(), {
    state: AuthState.createPassword,
    mnemonic,
    mnemonicCheckIndexes: selectMnemonicForCheck(),
  }));
});

addActionHandler('afterCreatePassword', async (global, actions, { password, isImporting }) => {
  setGlobal(updateAuth(global, { isLoading: true }));

  const address = await callApi(isImporting ? 'importMnemonic' : 'createWallet', global.auth.mnemonic!, password);
  if (!address) {
    setGlobal(updateAuth(global, { isLoading: undefined }));
    return;
  }

  global = getGlobal();
  global = updateAuth(global, {
    isLoading: undefined,
    state: isImporting ? AuthState.ready : AuthState.createBackup,
    address: isImporting ? undefined : address,
  });

  if (isImporting) {
    global = updateAddress(global, MAIN_ACCOUNT_ID, address);
  }

  setGlobal(global);

  actions.afterSignIn();
});

addActionHandler('afterCheckMnemonic', (global) => {
  setGlobal(updateAddress(global, MAIN_ACCOUNT_ID, global.auth.address!));
});

addActionHandler('restartCheckMnemonicIndexes', (global) => {
  setGlobal(updateAuth(global, {
    mnemonicCheckIndexes: selectMnemonicForCheck(),
  }));
});

addActionHandler('skipCheckMnemonic', (global) => {
  global = {
    ...global,
    isBackupRequired: true,
  };
  global = updateAddress(global, MAIN_ACCOUNT_ID, global.auth.address!);
  setGlobal(global);
});

addActionHandler('startImportingWallet', (global) => {
  setGlobal(updateAuth(global, { state: AuthState.importWallet, error: undefined }));
});

addActionHandler('afterImportMnemonic', async (global, actions, { mnemonic }) => {
  const isValid = await callApi('validateMnemonic', mnemonic);
  if (!isValid) {
    setGlobal(updateAuth(getGlobal(), {
      error: 'Your mnemonic words are invalid.',
    }));

    return;
  }

  setGlobal(updateAuth(getGlobal(), {
    state: AuthState.importWalletCreatePassword,
    error: undefined,
    mnemonic,
  }));
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

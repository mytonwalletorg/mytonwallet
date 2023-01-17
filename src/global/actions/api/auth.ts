import { AuthState } from '../../types';
import { callApi } from '../../../api';
import {
  addActionHandler, getGlobal, setGlobal,
} from '../..';
import { pause } from '../../../util/schedulers';
import { MNEMONIC_CHECK_COUNT, MNEMONIC_COUNT } from '../../../config';
import { updateAccount, updateAuth, updateCurrentAccountsState } from '../../reducers';
import { INITIAL_STATE } from '../../initialState';
import { cloneDeep } from '../../../util/iteratees';
import { buildAccountId, parseAccountId } from '../../../util/account';
import { selectAccountState } from '../../selectors';
import { getIsTxIdLocal } from '../../helpers';

const CREATING_DURATION = 3300;

addActionHandler('restartAuth', (global) => {
  if (global.auth.prevAccountId) {
    global = { ...global, currentAccountId: global.auth.prevAccountId };
  }

  global = { ...global, auth: cloneDeep(INITIAL_STATE.auth) };

  setGlobal(global);
});

addActionHandler('startCreatingWallet', async (global, actions) => {
  setGlobal(updateAuth(global, { state: AuthState.creatingWallet, error: undefined }));

  const [mnemonic] = await Promise.all([
    callApi('generateMnemonic'),
    pause(CREATING_DURATION),
  ]);

  global = updateAuth(getGlobal(), {
    mnemonic,
    mnemonicCheckIndexes: selectMnemonicForCheck(),
  });

  if (global.auth.prevAccountId) {
    setGlobal(global);
    actions.afterCreatePassword({ password: global.auth.password! });

    return;
  }

  setGlobal(updateAuth(global, { state: AuthState.createPassword }));
});

addActionHandler('afterCreatePassword', async (global, actions, { password, isImporting }) => {
  setGlobal(updateAuth(global, { isLoading: true }));

  const { isTestnet } = getGlobal().settings;
  const network = isTestnet ? 'testnet' : 'mainnet';

  const result = await callApi(
    isImporting ? 'importMnemonic' : 'createWallet',
    network,
    global.auth.mnemonic!,
    password,
  );

  if (!result) {
    setGlobal(updateAuth(global, { isLoading: undefined }));
    return;
  }

  global = getGlobal();
  global = updateAuth(global, {
    isLoading: undefined,
    prevAccountId: undefined,
    password: undefined,
  });
  const {
    accountId,
    address,
  } = result;

  if (isImporting) {
    global = { ...global, currentAccountId: accountId };
    global = updateAuth(global, {
      state: AuthState.ready,
    });
    global = updateAccount(global, accountId, address);

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

addActionHandler('afterCheckMnemonic', (global, actions) => {
  global = { ...global, currentAccountId: global.auth.accountId! };
  global = updateCurrentAccountsState(global, {});
  global = updateAccount(global, global.auth.accountId!, global.auth.address!);
  setGlobal(global);

  actions.afterSignIn();
});

addActionHandler('restartCheckMnemonicIndexes', (global) => {
  setGlobal(updateAuth(global, {
    mnemonicCheckIndexes: selectMnemonicForCheck(),
  }));
});

addActionHandler('skipCheckMnemonic', (global, actions) => {
  global = { ...global, currentAccountId: global.auth.accountId! };
  global = updateCurrentAccountsState(global, {
    backupWallet: undefined,
    isBackupRequired: true,
  });
  global = updateAccount(global, global.auth.accountId!, global.auth.address!);
  setGlobal(global);

  actions.afterSignIn();
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

  global = updateAuth(getGlobal(), {
    mnemonic,
    error: undefined,
  });

  if (global.auth.prevAccountId) {
    setGlobal(global);
    actions.afterCreatePassword({ password: global.auth.password!, isImporting: true });

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
  const newestTxId = selectAccountState(global, accountId)
    ?.transactions?.orderedTxIds?.find((id) => !getIsTxIdLocal(id));

  await callApi('switchAccount', accountId, newestTxId);

  setGlobal({
    ...getGlobal(),
    currentAccountId: accountId,
  });

  if (newNetwork) {
    actions.changeNetwork({ network: newNetwork });
  }
});

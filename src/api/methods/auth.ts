import type { LedgerWalletInfo } from '../../util/ledger/types';
import type { TonWallet } from '../blockchains/ton/util/tonCore';
import type {
  ApiAccount, ApiNetwork, ApiTxIdBySlug, ApiWalletVersion,
} from '../types';
import { ApiCommonError } from '../types';

import { DEFAULT_WALLET_VERSION } from '../../config';
import { parseAccountId } from '../../util/account';
import isMnemonicPrivateKey from '../../util/isMnemonicPrivateKey';
import blockchains from '../blockchains';
import { privateKeyHexToKeyPair } from '../blockchains/ton/auth';
import { toBase64Address } from '../blockchains/ton/util/tonCore';
import {
  fetchStoredAccount,
  getAccountIds,
  getAccountValue,
  getNewAccountId,
  removeAccountValue,
  removeNetworkAccountsValue,
  setAccountValue,
} from '../common/accounts';
import { bytesToHex, hexToBytes } from '../common/utils';
import { apiDb } from '../db';
import { getEnvironment } from '../environment';
import { handleServerError } from '../errors';
import { storage } from '../storages';
import { activateAccount, deactivateAllAccounts, deactivateCurrentAccount } from './accounts';
import { removeAccountDapps, removeAllDapps, removeNetworkDapps } from './dapps';

export function generateMnemonic() {
  return blockchains.ton.generateMnemonic();
}

export async function createWallet(
  network: ApiNetwork,
  mnemonic: string[],
  password: string,
  version?: ApiWalletVersion,
) {
  if (!version) version = DEFAULT_WALLET_VERSION;

  const {
    mnemonicToKeyPair,
    publicKeyToAddress,
  } = blockchains.ton;

  if (!await validateMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic');
  }

  const { publicKey } = await mnemonicToKeyPair(mnemonic);
  const address = publicKeyToAddress(network, publicKey, version);

  const accountId = await getNewAccountId(network);
  const result = await storeAccount(accountId, mnemonic, password, {
    address,
    publicKey: bytesToHex(publicKey),
    version,
  });

  if ('error' in result) {
    return result as { error: string };
  }

  void activateAccount(accountId);

  return {
    accountId,
    address,
  };
}

export function validateMnemonic(mnemonic: string[]) {
  return blockchains.ton.validateMnemonic(mnemonic);
}

export async function importMnemonic(network: ApiNetwork, mnemonic: string[], password: string) {
  const {
    mnemonicToKeyPair,
    pickBestWallet,
  } = blockchains.ton;

  const isPrivateKey = isMnemonicPrivateKey(mnemonic);

  if (!isMnemonicPrivateKey(mnemonic) && !await validateMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic');
  }

  const { publicKey } = isPrivateKey ? privateKeyHexToKeyPair(mnemonic[0]) : await mnemonicToKeyPair(mnemonic);
  let wallet: TonWallet;
  let version: ApiWalletVersion;

  try {
    ({ wallet, version } = await pickBestWallet(network, publicKey));
  } catch (err: any) {
    return handleServerError(err);
  }

  const address = toBase64Address(wallet.address, false, network);

  const accountId: string = await getNewAccountId(network);
  const result = await storeAccount(accountId, mnemonic, password, {
    publicKey: bytesToHex(publicKey),
    address,
    version,
  });

  if ('error' in result) {
    return result as { error: string };
  }

  void activateAccount(accountId);

  return {
    accountId,
    address,
  };
}

export async function importLedgerWallet(network: ApiNetwork, walletInfo: LedgerWalletInfo) {
  const accountId: string = await getNewAccountId(network);
  const {
    publicKey, address, index, driver, deviceId, deviceName, version,
  } = walletInfo;

  await storeHardwareAccount(accountId, {
    address,
    publicKey,
    version,
    ledger: {
      index,
      driver,
      deviceId,
      deviceName,
    },
  });
  void activateAccount(accountId);

  return { accountId, address, walletInfo };
}

export async function importNewWalletVersion(accountId: string, version: ApiWalletVersion) {
  const { publicKeyToAddress } = blockchains.ton;
  const { network } = parseAccountId(accountId);

  const account = await fetchStoredAccount(accountId);
  const mnemonicEncrypted = await getAccountValue(accountId, 'mnemonicsEncrypted');
  const publicKey = hexToBytes(account.publicKey);

  const newAddress = publicKeyToAddress(network, publicKey, version);
  const newAccountId = await getNewAccountId(network);
  const newAccount: ApiAccount = {
    address: newAddress,
    publicKey: account.publicKey,
    version,
  };

  await Promise.all([
    setAccountValue(newAccountId, 'mnemonicsEncrypted', mnemonicEncrypted),
    setAccountValue(newAccountId, 'accounts', newAccount),
  ]);

  void activateAccount(newAccountId);

  return {
    accountId: newAccountId,
    address: newAddress,
  };
}

function storeHardwareAccount(accountId: string, account?: ApiAccount) {
  return setAccountValue(accountId, 'accounts', account);
}

async function storeAccount(accountId: string, mnemonic: string[], password: string, account: ApiAccount) {
  const mnemonicEncrypted = await blockchains.ton.encryptMnemonic(mnemonic, password);

  // This is a defensive approach against potential corrupted encryption reported by some users
  const decryptedMnemonic = await blockchains.ton.decryptMnemonic(mnemonicEncrypted, password)
    .catch(() => undefined);

  if (!password || !decryptedMnemonic) {
    return { error: ApiCommonError.DebugError };
  }

  await Promise.all([
    setAccountValue(accountId, 'mnemonicsEncrypted', mnemonicEncrypted),
    setAccountValue(accountId, 'accounts', account),
  ]);

  return {};
}

export async function removeNetworkAccounts(network: ApiNetwork) {
  deactivateAllAccounts();

  await Promise.all([
    removeNetworkAccountsValue(network, 'mnemonicsEncrypted'),
    removeNetworkAccountsValue(network, 'accounts'),
    getEnvironment().isDappSupported && removeNetworkDapps(network),
  ]);
}

export async function resetAccounts() {
  deactivateAllAccounts();

  await Promise.all([
    storage.removeItem('mnemonicsEncrypted'),
    storage.removeItem('accounts'),
    storage.removeItem('currentAccountId'),
    getEnvironment().isDappSupported && removeAllDapps(),
    apiDb.nfts.clear(),
  ]);
}

export async function removeAccount(accountId: string, nextAccountId: string, newestTxIds?: ApiTxIdBySlug) {
  await Promise.all([
    removeAccountValue(accountId, 'mnemonicsEncrypted'),
    removeAccountValue(accountId, 'accounts'),
    getEnvironment().isDappSupported && removeAccountDapps(accountId),
    apiDb.nfts.where({ accountId }).delete(),
  ]);

  deactivateCurrentAccount();
  await activateAccount(nextAccountId, newestTxIds);
}

export async function changePassword(oldPassword: string, password: string) {
  for (const accountId of await getAccountIds()) {
    const mnemonic = await blockchains.ton.fetchMnemonic(accountId, oldPassword);
    if (!mnemonic) {
      throw new Error('Incorrect password');
    }

    const encryptedMnemonic = await blockchains.ton.encryptMnemonic(mnemonic, password);
    await setAccountValue(accountId, 'mnemonicsEncrypted', encryptedMnemonic);
  }
}

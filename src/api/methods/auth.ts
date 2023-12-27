import type { LedgerWalletInfo } from '../../util/ledger/types';
import type { ApiAccount, ApiNetwork, ApiTxIdBySlug } from '../types';

import blockchains from '../blockchains';
import { toBase64Address } from '../blockchains/ton/util/tonweb';
import {
  getAccountIds,
  getNewAccountId,
  removeAccountValue,
  removeNetworkAccountsValue,
  setAccountValue,
} from '../common/accounts';
import { bytesToHex } from '../common/utils';
import { apiDb } from '../db';
import { getEnvironment } from '../environment';
import { handleServerError } from '../errors';
import { storage } from '../storages';
import { activateAccount, deactivateAllAccounts, deactivateCurrentAccount } from './accounts';
import { removeAccountDapps, removeAllDapps, removeNetworkDapps } from './dapps';

export function generateMnemonic() {
  return blockchains.ton.generateMnemonic();
}

export async function createWallet(network: ApiNetwork, mnemonic: string[], password: string) {
  const {
    mnemonicToSeed,
    seedToKeyPair,
    publicKeyToAddress,
  } = blockchains.ton;

  if (!await validateMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic');
  }

  const seedBase64 = await mnemonicToSeed(mnemonic);
  const { publicKey } = seedToKeyPair(seedBase64);
  const address = await publicKeyToAddress(network, publicKey);

  const accountId = await getNewAccountId(network);
  await storeAccount(accountId, mnemonic, password, {
    address,
    publicKey: bytesToHex(publicKey),
  });
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
    mnemonicToSeed,
    seedToKeyPair,
    pickBestWallet,
  } = blockchains.ton;

  if (!await validateMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic');
  }

  const seedBase64 = await mnemonicToSeed(mnemonic);
  const { publicKey } = seedToKeyPair(seedBase64);
  let wallet: Awaited<ReturnType<typeof pickBestWallet>>;

  try {
    wallet = await pickBestWallet(network, publicKey);
  } catch (err: any) {
    return handleServerError(err);
  }

  const address = toBase64Address(await wallet.getAddress(), false);

  const accountId: string = await getNewAccountId(network);
  await storeAccount(accountId, mnemonic, password, {
    publicKey: bytesToHex(publicKey),
    address,
  });
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

function storeHardwareAccount(accountId: string, account?: ApiAccount) {
  return setAccountValue(accountId, 'accounts', account);
}

async function storeAccount(accountId: string, mnemonic: string[], password: string, account: ApiAccount) {
  const mnemonicEncrypted = await blockchains.ton.encryptMnemonic(mnemonic, password);

  await Promise.all([
    setAccountValue(accountId, 'mnemonicsEncrypted', mnemonicEncrypted),
    setAccountValue(accountId, 'accounts', account),
  ]);
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

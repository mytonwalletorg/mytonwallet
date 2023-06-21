import type { LedgerWalletInfo } from '../../util/ledger/types';
import type { Storage } from '../storages/types';
import type { ApiAccountInfo, ApiNetwork, ApiTxIdBySlug } from '../types';

import blockchains from '../blockchains';
import { getNewAccountId, removeAccountValue, setAccountValue } from '../common/accounts';
import { bytesToHex } from '../common/utils';
import { IS_EXTENSION } from '../environment';
import { activateAccount, deactivateAllAccounts, deactivateCurrentAccount } from './accounts';

let storage: Storage;

export function initAuth(_storage: Storage) {
  storage = _storage;
}

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

  const accountId = await getNewAccountId(storage, network);
  await storeAccount(accountId, mnemonic, password, publicKey, address);
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
  const wallet = await pickBestWallet(network, publicKey);
  const address = (await wallet.getAddress()).toString(true, true, true);

  const accountId: string = await getNewAccountId(storage, network);
  await storeAccount(accountId, mnemonic, password, publicKey, address);
  void activateAccount(accountId);

  return {
    accountId,
    address,
  };
}

export async function importLedgerWallet(network: ApiNetwork, walletInfo: LedgerWalletInfo) {
  const accountId: string = await getNewAccountId(storage, network);
  const {
    publicKey, address, index, driver, deviceId, deviceName, version,
  } = walletInfo;

  await storeHardwareAccount(accountId, publicKey, address, {
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

async function storeHardwareAccount(
  accountId: string,
  publicKey: Uint8Array | string,
  address: string,
  accountInfo: ApiAccountInfo = {},
) {
  const publicKeyHex = typeof publicKey === 'string' ? publicKey : bytesToHex(publicKey);

  await Promise.all([
    setAccountValue(storage, accountId, 'publicKeys', publicKeyHex),
    setAccountValue(storage, accountId, 'addresses', address),
    setAccountValue(storage, accountId, 'accounts', accountInfo),
  ]);
}

async function storeAccount(
  accountId: string,
  mnemonic: string[],
  password: string,
  publicKey: Uint8Array | string,
  address: string,
  accountInfo: ApiAccountInfo = {},
) {
  const mnemonicEncrypted = await blockchains.ton.encryptMnemonic(mnemonic, password);
  const publicKeyHex = typeof publicKey === 'string' ? publicKey : bytesToHex(publicKey);

  await Promise.all([
    setAccountValue(storage, accountId, 'mnemonicsEncrypted', mnemonicEncrypted),
    setAccountValue(storage, accountId, 'publicKeys', publicKeyHex),
    setAccountValue(storage, accountId, 'addresses', address),
    setAccountValue(storage, accountId, 'accounts', accountInfo),
  ]);
}

export async function resetAccounts() {
  deactivateAllAccounts();

  await Promise.all([
    storage.removeItem('addresses'),
    storage.removeItem('publicKeys'),
    storage.removeItem('mnemonicsEncrypted'),
    storage.removeItem('accounts'),
    IS_EXTENSION && storage.removeItem('dapps'),
  ]);
}

export async function removeAccount(accountId: string, nextAccountId: string, newestTxIds?: ApiTxIdBySlug) {
  await Promise.all([
    removeAccountValue(storage, accountId, 'addresses'),
    removeAccountValue(storage, accountId, 'publicKeys'),
    removeAccountValue(storage, accountId, 'mnemonicsEncrypted'),
    removeAccountValue(storage, accountId, 'accounts'),
    IS_EXTENSION && removeAccountValue(storage, accountId, 'dapps'),
  ]);

  deactivateCurrentAccount();
  await activateAccount(nextAccountId, newestTxIds);
}

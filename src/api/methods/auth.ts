import type { ApiNetwork, ApiTxIdBySlug } from '../types';
import type { Storage } from '../storages/types';

import { IS_EXTENSION } from '../environment';
import blockchains from '../blockchains';
import { getNewAccountId, removeAccountValue, setAccountValue } from '../common/accounts';
import { bytesToHex } from '../common/utils';

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

async function storeAccount(
  accountId: string, mnemonic: string[], password: string, publicKey: Uint8Array, address: string,
) {
  const mnemonicEncrypted = await blockchains.ton.encryptMnemonic(mnemonic, password);
  const publicKeyHex = bytesToHex(publicKey);

  await Promise.all([
    setAccountValue(storage, accountId, 'mnemonicsEncrypted', mnemonicEncrypted),
    setAccountValue(storage, accountId, 'publicKeys', publicKeyHex),
    setAccountValue(storage, accountId, 'addresses', address),
  ]);
}

export async function resetAccounts() {
  deactivateAllAccounts();

  await Promise.all([
    storage.removeItem('addresses'),
    storage.removeItem('publicKeys'),
    storage.removeItem('mnemonicsEncrypted'),
  ]);
}

export async function removeAccount(accountId: string, nextAccountId: string, newestTxIds?: ApiTxIdBySlug) {
  await Promise.all([
    removeAccountValue(storage, accountId, 'addresses'),
    removeAccountValue(storage, accountId, 'publicKeys'),
    removeAccountValue(storage, accountId, 'mnemonicsEncrypted'),
    IS_EXTENSION && removeAccountValue(storage, accountId, 'dapps'),
  ]);

  deactivateCurrentAccount();
  await activateAccount(nextAccountId, newestTxIds);
}

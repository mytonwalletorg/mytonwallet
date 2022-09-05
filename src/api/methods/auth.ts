import type { OnApiUpdate } from '../types';
import type { Storage } from '../storages/types';

import blockchains from '../blockchains';

import { MAIN_ACCOUNT_ID } from '../../config';
import { setupBalancePolling } from './wallet';
import { setupTransactionsPolling } from './transactions';
import { setupTokensPolling } from './tokens';
import { bytesToHex } from '../common/utils';

// let onUpdate: OnApiUpdate;
let storage: Storage;

export function initAuth(_onUpdate: OnApiUpdate, _storage: Storage) {
  // onUpdate = _onUpdate;
  storage = _storage;
}

export function generateMnemonic() {
  return blockchains.ton.generateMnemonic();
}

export async function createWallet(mnemonic: string[], password: string) {
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
  const address = await publicKeyToAddress(publicKey);
  const accountId = MAIN_ACCOUNT_ID;

  await storeAccount(accountId, mnemonic, password, publicKey, address);
  void setupBalancePolling(accountId);
  void setupTransactionsPolling(accountId);
  void setupTokensPolling(accountId);

  return address;
}

export function validateMnemonic(mnemonic: string[]) {
  return blockchains.ton.validateMnemonic(mnemonic);
}

export async function importMnemonic(mnemonic: string[], password: string) {
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
  const wallet = await pickBestWallet(publicKey);
  const address = (await wallet.getAddress()).toString(true, true, true);
  const accountId = MAIN_ACCOUNT_ID;

  await storeAccount(accountId, mnemonic, password, publicKey, address);
  void setupBalancePolling(accountId);
  void setupTransactionsPolling(accountId);
  void setupTokensPolling(accountId);

  return address;
}

async function storeAccount(
  accountId: string, mnemonic: string[], password: string, publicKey: Uint8Array, address: string,
) {
  const mnemonicEncrypted = await blockchains.ton.encryptMnemonic(mnemonic, password);
  const publicKeyHex = bytesToHex(publicKey);
  const publicKeys = { [accountId]: publicKeyHex };
  const addresses = { [accountId]: address };

  await storage.setItem('mnemonicEncrypted', mnemonicEncrypted);
  await storage.setItem('publicKeys', JSON.stringify(publicKeys));
  await storage.setItem('addresses', JSON.stringify(addresses));
}

export async function resetAccount() {
  await storage.removeItem('addresses');
  await storage.removeItem('publicKeys');
  await storage.removeItem('mnemonicEncrypted');
}

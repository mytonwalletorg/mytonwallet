import type { Storage } from '../storages/types';
import type { ApiNetwork, OnApiUpdate } from '../types';

import { parseAccountId } from '../../util/account';
import blockchains from '../blockchains';

// let onUpdate: OnApiUpdate;
// let storage: Storage;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function initTokens(_onUpdate: OnApiUpdate, _storage: Storage) {
  // onUpdate = _onUpdate;
  // storage = _storage;
}

export function importToken(accountId: string, address: string) {
  const { network, blockchain: blockchainKey } = parseAccountId(accountId);

  const blockchain = blockchains[blockchainKey];

  return blockchain.importToken(network, address);
}

export function resolveTokenBySlug(slug: string) {
  const blockchain = blockchains.ton;

  return blockchain.resolveTokenBySlug(slug);
}

export function resolveTokenWalletAddress(network: ApiNetwork, address: string, minterAddress: string) {
  const blockchain = blockchains.ton;

  return blockchain.resolveTokenWalletAddress(network, address, minterAddress);
}

export function resolveTokenMinterAddress(network: ApiNetwork, tokenWalletAddress: string) {
  const blockchain = blockchains.ton;

  return blockchain.resolveTokenMinterAddress(network, tokenWalletAddress);
}

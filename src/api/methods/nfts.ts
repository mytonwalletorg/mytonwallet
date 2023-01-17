import type { Storage } from '../storages/types';

import blockchains from '../blockchains';
import { resolveBlockchainKey } from '../common/helpers';

let storage: Storage;

export function initNfts(_storage: Storage) {
  storage = _storage;
}

export function fetchNfts(accountId: string) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  return blockchain.getAccountNfts(storage, accountId);
}

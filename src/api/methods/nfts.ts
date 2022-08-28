import type { Storage } from '../storages/types';

import blockchains from '../blockchains';
import { resolveBlockchainKey } from './helpers';
import { MAIN_ACCOUNT_ID } from '../../config';

let storage: Storage;

export function initNfts(_storage: Storage) {
  storage = _storage;
}

export function fetchNfts() {
  const accountId = MAIN_ACCOUNT_ID;
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  return blockchain.getAccountNfts(storage, accountId);
}

import type { Storage } from '../storages/types';
import type { OnApiUpdate } from '../types';

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

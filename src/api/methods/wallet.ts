import type { OnApiUpdate } from '../types';
import type { Storage } from '../storages/types';

import blockchains from '../blockchains';

import * as dappPromises from '../common/dappPromises';
import { resolveBlockchainKey } from '../common/helpers';
import { getMainAccountId } from '../common/accounts';

let onUpdate: OnApiUpdate;
let storage: Storage;

export async function initWallet(_onUpdate: OnApiUpdate, _storage: Storage) {
  onUpdate = _onUpdate;
  storage = _storage;

  const isTonProxyEnabled = await storage.getItem('isTonProxyEnabled');
  onUpdate({
    type: 'updateTonProxyState',
    isEnabled: Boolean(isTonProxyEnabled),
  });

  const isTonMagicEnabled = await storage.getItem('isTonMagicEnabled');
  onUpdate({
    type: 'updateTonMagicState',
    isEnabled: Boolean(isTonMagicEnabled),
  });
}

export function getMnemonic(accountId: string, password: string) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  return blockchain.fetchMnemonic(storage, accountId, password);
}

export async function verifyPassword(password: string) {
  const accountId = await getMainAccountId(storage);
  if (!accountId) {
    throw new Error('The user is not authorized in the wallet');
  }

  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  return blockchain.verifyPassword(storage, accountId, password);
}

export function confirmDappRequest(promiseId: string, password: string) {
  dappPromises.resolveDappPromise(promiseId, password);
}

export function confirmDappRequestConnect(promiseId: string, password?: string, additionalAccountIds?: string[]) {
  dappPromises.resolveDappPromise(promiseId, { isUserAllowed: true, additionalAccountIds, password });
}

export function cancelDappRequest(promiseId: string, reason?: string) {
  dappPromises.rejectDappPromise(promiseId, reason);
}

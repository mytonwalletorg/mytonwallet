import type { Storage } from '../storages/types';
import type { ApiNetwork, OnApiUpdate } from '../types';

import { parseAccountId } from '../../util/account';
import blockchains from '../blockchains';
import {
  fetchStoredAddress,
  fetchStoredPublicKey,
  getMainAccountId,
} from '../common/accounts';
import * as dappPromises from '../common/dappPromises';
import { resolveBlockchainKey } from '../common/helpers';

let onUpdate: OnApiUpdate;
let storage: Storage;

const ton = blockchains.ton;

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

  const isDeeplinkHookEnabled = await storage.getItem('isDeeplinkHookEnabled');
  onUpdate({
    type: 'updateDeeplinkHookState',
    isEnabled: Boolean(isDeeplinkHookEnabled),
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

export function confirmDappRequest(promiseId: string, data: any) {
  dappPromises.resolveDappPromise(promiseId, data);
}

export function confirmDappRequestConnect(promiseId: string, data: {
  password?: string;
  additionalAccountIds?: string[];
  signature?: string;
}) {
  dappPromises.resolveDappPromise(promiseId, data);
}

export function cancelDappRequest(promiseId: string, reason?: string) {
  dappPromises.rejectDappPromise(promiseId, reason);
}

export async function getWalletSeqno(accountId: string) {
  const { network } = parseAccountId(accountId);
  const address = await fetchStoredAddress(storage, accountId);
  return ton.getWalletSeqno(network, address);
}

export function fetchAddress(accountId: string) {
  return fetchStoredAddress(storage, accountId);
}

export function fetchPublicKey(accountId: string) {
  return fetchStoredPublicKey(storage, accountId);
}

export function isWalletInitialized(network: ApiNetwork, address: string) {
  const blockchain = blockchains.ton;

  return blockchain.isWalletInitialized(network, address);
}

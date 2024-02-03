import * as tonWebMnemonic from 'tonweb-mnemonic';

import type { ApiNetwork } from '../types';

import { parseAccountId } from '../../util/account';
import blockchains from '../blockchains';
import {
  fetchStoredAddress,
  getAccountIdWithMnemonic,
} from '../common/accounts';
import * as dappPromises from '../common/dappPromises';
import { resolveBlockchainKey } from '../common/helpers';

const ton = blockchains.ton;

export function getMnemonic(accountId: string, password: string) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  return blockchain.fetchMnemonic(accountId, password);
}

export function getMnemonicWordList() {
  return tonWebMnemonic.wordlists.default;
}

export async function verifyPassword(password: string) {
  const accountId = await getAccountIdWithMnemonic();
  if (!accountId) {
    throw new Error('The user is not authorized in the wallet');
  }

  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  return blockchain.verifyPassword(accountId, password);
}

export function confirmDappRequest(promiseId: string, data: any) {
  dappPromises.resolveDappPromise(promiseId, data);
}

export function confirmDappRequestConnect(promiseId: string, data: {
  password?: string;
  accountId?: string;
  signature?: string;
}) {
  dappPromises.resolveDappPromise(promiseId, data);
}

export function cancelDappRequest(promiseId: string, reason?: string) {
  dappPromises.rejectDappPromise(promiseId, reason);
}

export async function getWalletSeqno(accountId: string) {
  const { network } = parseAccountId(accountId);
  const address = await fetchStoredAddress(accountId);
  return ton.getWalletSeqno(network, address);
}

export function fetchAddress(accountId: string) {
  return fetchStoredAddress(accountId);
}

export function isWalletInitialized(network: ApiNetwork, address: string) {
  const blockchain = blockchains.ton;

  return blockchain.isAddressInitialized(network, address);
}

export function getWalletBalance(network: ApiNetwork, address: string) {
  const blockchain = blockchains.ton;

  return blockchain.getWalletBalance(network, address);
}

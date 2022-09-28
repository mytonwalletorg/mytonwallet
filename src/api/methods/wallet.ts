import type { OnApiUpdate } from '../types';
import type { Storage } from '../storages/types';

import blockchains from '../blockchains';

import {
  DEBUG,
  MAIN_ACCOUNT_ID,
} from '../../config';
import { pause } from '../../util/schedulers';
import * as dappPromises from '../common/dappPromises';
import { checkAccountIsAuthorized, isUpdaterAlive, resolveBlockchainKey } from './helpers';
import { setupTransactionsPolling } from './transactions';
import { setupTokensPolling } from './tokens';

const POLLING_INTERVAL = 1100;

let onUpdate: OnApiUpdate;
let storage: Storage;

export async function initWallet(_onUpdate: OnApiUpdate, _storage: Storage, newestTxId?: string) {
  onUpdate = _onUpdate;
  storage = _storage;

  const addressesJson = await storage.getItem('addresses');
  if (!addressesJson) {
    return;
  }

  const accountIds = Object.keys(JSON.parse(addressesJson) as Record<string, string>);

  Object.keys(accountIds).forEach((accountId) => {
    setupBalancePolling(accountId);
    setupTransactionsPolling(accountId, newestTxId);
    setupTokensPolling(accountId);
  });

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

export async function setupBalancePolling(accountId: string) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  while (isUpdaterAlive(onUpdate) && await checkAccountIsAuthorized(storage, accountId)) {
    try {
      // toncoin
      const balance = await blockchain.getAccountBalance(storage, accountId);
      if (balance) {
        onUpdate({
          type: 'updateBalance',
          accountId,
          slug: 'toncoin',
          balance,
        });
      }

      // tokens
      const tokensBalances = await blockchain.getAccountTokenBalances(storage, accountId);
      for (const [tokenSlug, tokenBalance] of Object.entries(tokensBalances)) {
        onUpdate({
          type: 'updateBalance',
          accountId,
          slug: tokenSlug,
          balance: tokenBalance,
        });
      }
    } catch (err) {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.error('[setupBalancePolling]', err);
      }
    }

    await pause(POLLING_INTERVAL);
  }
}

export function getMnemonic(password: string, accountId?: string) {
  accountId = MAIN_ACCOUNT_ID;
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  return blockchain.fetchMnemonic(storage, accountId, password);
}

export function verifyPassword(password: string, accountId?: string) {
  accountId = MAIN_ACCOUNT_ID;
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  return blockchain.verifyPassword(storage, accountId, password);
}

export function confirmDappRequest(promiseId: string, password: string) {
  dappPromises.resolveDappPromise(promiseId, password);
}

export function cancelDappRequest(promiseId: string, reason?: string) {
  dappPromises.rejectDappPromise(promiseId, reason);
}

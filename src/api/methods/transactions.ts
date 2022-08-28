import type { OnApiUpdate } from '../types';
import type { Storage } from '../storages/types';

import { MAIN_ACCOUNT_ID, TON_TOKEN_SLUG } from '../../config';
import { pause } from '../../util/schedulers';
import blockchains from '../blockchains';
import { txCallbacks, whenTxComplete } from '../common/txCallbacks';
import { checkAccountIsAuthorized, resolveBlockchainKey } from './helpers';

const POLLING_INTERVAL = 1100;

let onUpdate: OnApiUpdate;
let storage: Storage;

export function initTransactions(_onUpdate: OnApiUpdate, _storage: Storage) {
  onUpdate = _onUpdate;
  storage = _storage;
}

export function fetchTransactions() {
  const accountId = MAIN_ACCOUNT_ID;
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  return blockchain.getAccountTransactionSlice(storage, accountId);
}

export function fetchTransactionSlice(beforeTxId?: string, limit?: number) {
  const accountId = MAIN_ACCOUNT_ID;
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  return blockchain.getAccountTransactionSlice(storage, accountId, beforeTxId, undefined, limit);
}

export async function setupTransactionsPolling(accountId: string) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];
  let latestTxId = await blockchain.getAccountLatestTxId(storage, accountId);

  while (await checkAccountIsAuthorized(storage, accountId)) {
    try {
      const transactions = await blockchain.getAccountTransactionSlice(storage, accountId, undefined, latestTxId);
      if (transactions.length) {
        latestTxId = transactions[0].txId;

        // eslint-disable-next-line @typescript-eslint/no-loop-func
        transactions.reverse().forEach((transaction) => {
          txCallbacks.runCallbacks(transaction);

          onUpdate({
            type: 'newTransaction',
            transaction,
          });
        });
      }
    } catch (err) {
      // Do nothing
    }

    await pause(POLLING_INTERVAL);
  }
}

export function checkTransactionDraft(toAddress: string, amount: string, comment?: string) {
  const accountId = MAIN_ACCOUNT_ID;
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  return blockchain.checkTransactionDraft(storage, accountId, TON_TOKEN_SLUG, toAddress, amount, comment);
}

export async function submitTransfer(
  password: string, toAddress: string, amount: string, comment?: string,
) {
  const accountId = MAIN_ACCOUNT_ID;
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];
  const result = await blockchain.submitTransfer(
    storage, accountId, password, TON_TOKEN_SLUG, toAddress, amount, comment,
  );

  if (result) {
    whenTxComplete(result.resolvedAddress, result.amount).then(({ txId }) => {
      onUpdate({
        type: 'updateTxComplete',
        toAddress,
        amount,
        txId,
      });
    });
  }

  return Boolean(result);
}

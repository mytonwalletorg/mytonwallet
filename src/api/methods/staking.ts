import type { ApiBackendStakingState, OnApiUpdate } from '../types';
import type { Storage } from '../storages/types';

import { STAKE_COMMENT, UNSTAKE_COMMENT } from '../blockchains/ton/constants';
import { TON_TOKEN_SLUG } from '../../config';
import blockchains from '../blockchains';
import { buildLocalTransaction, resolveBlockchainKey } from '../common/helpers';
import { whenTxComplete } from '../common/txCallbacks';

let onUpdate: OnApiUpdate;
let storage: Storage;

export function initStaking(_onUpdate: OnApiUpdate, _storage: Storage) {
  onUpdate = _onUpdate;
  storage = _storage;
}

export function checkStakeDraft(accountId: string, amount: string) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  return blockchain.checkStakeDraft(storage, accountId, amount);
}

export function checkUnstakeDraft(accountId: string) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  return blockchain.checkUnstakeDraft(storage, accountId);
}

export async function submitStake(accountId: string, password: string, amount: string, fee?: string) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];
  const fromAddress = await blockchain.fetchAddress(storage, accountId);

  const result = await blockchain.submitStake(storage, accountId, password, amount);
  if (result) {
    const localTransaction = buildLocalTransaction({
      amount: result.amount,
      fromAddress,
      toAddress: result.resolvedAddress,
      comment: STAKE_COMMENT,
      fee: fee || '0',
      type: 'stake',
      slug: TON_TOKEN_SLUG,
    });

    onUpdate({
      type: 'newTransaction',
      transaction: localTransaction,
      accountId,
    });

    whenTxComplete(result.resolvedAddress, result.amount)
      .then(({ txId }) => {
        onUpdate({
          type: 'updateTxComplete',
          toAddress: result.resolvedAddress,
          amount: result.amount,
          txId,
          localTxId: localTransaction.txId,
        });
      });

    return localTransaction.txId;
  }

  return false;
}

export async function submitUnstake(accountId: string, password: string, fee?: string) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];
  const toAddress = await blockchain.fetchAddress(storage, accountId);

  const result = await blockchain.submitUnstake(storage, accountId, password);
  if (result) {
    const localTransaction = buildLocalTransaction({
      amount: result.amount,
      fromAddress: result.resolvedAddress,
      toAddress,
      comment: UNSTAKE_COMMENT,
      fee: fee || '0',
      type: 'unstakeRequest',
      slug: TON_TOKEN_SLUG,
    });

    onUpdate({
      type: 'newTransaction',
      transaction: localTransaction,
      accountId,
    });

    whenTxComplete(result.resolvedAddress, result.amount)
      .then(({ txId }) => {
        onUpdate({
          type: 'updateTxComplete',
          toAddress: result.resolvedAddress,
          amount: result.amount,
          txId,
          localTxId: localTransaction.txId,
        });
      });

    return localTransaction.txId;
  }

  return false;
}

export function getStakingState(accountId: string) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  return blockchain.getStakingState(storage, accountId);
}

export async function getBackendStakingState(accountId: string): Promise<ApiBackendStakingState | undefined> {
  const state = await blockchains.ton.getBackendStakingState(storage, accountId);
  if (!state) {
    return state;
  }

  const poolState = state.poolState;
  return {
    ...state,
    poolState: {
      ...poolState,
      startOfCycle: poolState!.startOfCycle * 1000,
      endOfCycle: poolState!.endOfCycle * 1000,
    },
  };
}

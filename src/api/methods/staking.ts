import type { Storage } from '../storages/types';
import type { ApiBackendStakingState, OnApiUpdate } from '../types';

import { TON_TOKEN_SLUG } from '../../config';
import blockchains from '../blockchains';
import { STAKE_COMMENT, UNSTAKE_COMMENT } from '../blockchains/ton/constants';
import { fetchStoredAddress } from '../common/accounts';
import { createLocalTransaction, resolveBlockchainKey } from '../common/helpers';

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
  const fromAddress = await fetchStoredAddress(storage, accountId);

  const result = await blockchain.submitStake(storage, accountId, password, amount);
  if ('error' in result) {
    return false;
  }

  const localTransaction = createLocalTransaction(onUpdate, accountId, {
    amount: result.amount,
    fromAddress,
    toAddress: result.resolvedAddress,
    comment: STAKE_COMMENT,
    fee: fee || '0',
    type: 'stake',
    slug: TON_TOKEN_SLUG,
  });

  return {
    ...result,
    txId: localTransaction.txId,
  };
}

export async function submitUnstake(accountId: string, password: string, fee?: string) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];
  const toAddress = await fetchStoredAddress(storage, accountId);

  const result = await blockchain.submitUnstake(storage, accountId, password);
  if ('error' in result) {
    return false;
  }

  const localTransaction = createLocalTransaction(onUpdate, accountId, {
    amount: result.amount,
    fromAddress: result.resolvedAddress,
    toAddress,
    comment: UNSTAKE_COMMENT,
    fee: fee || '0',
    type: 'unstakeRequest',
    slug: TON_TOKEN_SLUG,
  });

  return {
    ...result,
    txId: localTransaction.txId,
  };
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

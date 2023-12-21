import type {
  ApiBackendStakingState,
  ApiStakingCommonData,
  ApiStakingHistory,
  ApiStakingType,
} from '../types';

import { TON_TOKEN_SLUG } from '../../config';
import { logDebugError } from '../../util/logs';
import blockchains from '../blockchains';
import { STAKE_COMMENT, UNSTAKE_COMMENT } from '../blockchains/ton/constants';
import { fetchStoredAddress } from '../common/accounts';
import { callBackendGet } from '../common/backend';
import { resolveBlockchainKey } from '../common/helpers';
import { isKnownStakingPool } from '../common/utils';
import { createLocalTransaction } from './transactions';

const CACHE_TTL = 60000; // 1 m.
let backendStakingStateByAddress: Record<string, [number, ApiBackendStakingState]> = {};
let stakingCommonData: ApiStakingCommonData;

// let onUpdate: OnApiUpdate;

export function initStaking() {
  // onUpdate = _onUpdate;
}

export async function checkStakeDraft(accountId: string, amount: string) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  const backendState = await getBackendStakingState(accountId);
  return blockchain.checkStakeDraft(accountId, amount, stakingCommonData!, backendState!);
}

export async function checkUnstakeDraft(accountId: string, amount: string) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  const backendState = await getBackendStakingState(accountId);
  return blockchain.checkUnstakeDraft(accountId, amount, stakingCommonData!, backendState!);
}

export async function submitStake(
  accountId: string, password: string, amount: string, type: ApiStakingType, fee?: string,
) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];
  const fromAddress = await fetchStoredAddress(accountId);

  const backendState = await getBackendStakingState(accountId);
  const result = await blockchain.submitStake(
    accountId, password, amount, type, backendState!,
  );
  if ('error' in result) {
    return false;
  }

  onStakingChangeExpected();

  const localTransaction = createLocalTransaction(accountId, {
    amount: result.amount,
    fromAddress,
    toAddress: result.normalizedAddress,
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

export async function submitUnstake(
  accountId: string,
  password: string,
  type: ApiStakingType,
  amount: string,
  fee?: string,
) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];
  const fromAddress = await fetchStoredAddress(accountId);

  const backendState = await getBackendStakingState(accountId);
  const result = await blockchain.submitUnstake(accountId, password, type, amount, backendState!);
  if ('error' in result) {
    return false;
  }

  onStakingChangeExpected();

  const localTransaction = createLocalTransaction(accountId, {
    amount: result.amount,
    fromAddress,
    toAddress: result.normalizedAddress,
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

export async function getBackendStakingState(accountId: string): Promise<ApiBackendStakingState> {
  const address = await fetchStoredAddress(accountId);
  const state = await fetchBackendStakingState(address);
  return {
    ...state,
    nominatorsPool: {
      ...state.nominatorsPool,
      start: state.nominatorsPool.start * 1000,
      end: state.nominatorsPool.end * 1000,
    },
  };
}

export async function fetchBackendStakingState(address: string): Promise<ApiBackendStakingState> {
  const cacheItem = backendStakingStateByAddress[address];
  if (cacheItem && cacheItem[0] > Date.now()) {
    return cacheItem[1];
  }

  const stakingState = await callBackendGet(`/staking/state/${address}`);

  if (!isKnownStakingPool(stakingState.nominatorsPool.address)) {
    throw Error('Unexpected pool address, likely a malicious activity');
  }

  backendStakingStateByAddress[address] = [Date.now() + CACHE_TTL, stakingState];

  return stakingState;
}

export async function getStakingHistory(
  accountId: string, limit?: number, offset?: number,
): Promise<ApiStakingHistory> {
  const address = await fetchStoredAddress(accountId);
  return callBackendGet(`/staking/profits/${address}`, { limit, offset });
}

export function onStakingChangeExpected() {
  backendStakingStateByAddress = {};
}

export async function tryUpdateStakingCommonData() {
  try {
    const data: ApiStakingCommonData = await callBackendGet('/staking/common');
    data.round.start *= 1000;
    data.round.end *= 1000;
    data.round.unlock *= 1000;
    data.prevRound.start *= 1000;
    data.prevRound.end *= 1000;
    data.prevRound.unlock *= 1000;
    stakingCommonData = data;
  } catch (err) {
    logDebugError('tryUpdateLiquidStakingState', err);
  }
}

export function getStakingCommonData() {
  return stakingCommonData!;
}

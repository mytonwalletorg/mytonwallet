import type {
  ApiStakingCommonData,
  ApiStakingHistory,
  ApiStakingType,
} from '../types';

import { TONCOIN } from '../../config';
import { fromDecimal } from '../../util/decimals';
import { logDebugError } from '../../util/logs';
import chains from '../chains';
import { getBackendStakingState } from '../chains/ton';
import { STAKE_COMMENT, UNSTAKE_COMMENT } from '../chains/ton/constants';
import { fetchStoredTonWallet } from '../common/accounts';
import { callBackendGet } from '../common/backend';
import { setStakingCommonCache } from '../common/cache';
import { createLocalTransaction } from './transactions';

const { ton } = chains;

export function initStaking() {
}

export async function checkStakeDraft(accountId: string, amount: bigint) {
  const backendState = await ton.getBackendStakingState(accountId);
  return ton.checkStakeDraft(accountId, amount, backendState!);
}

export async function checkUnstakeDraft(accountId: string, amount: bigint) {
  const backendState = await ton.getBackendStakingState(accountId);
  return ton.checkUnstakeDraft(accountId, amount, backendState!);
}

export async function submitStake(
  accountId: string,
  password: string,
  amount: bigint,
  type: ApiStakingType,
  fee?: bigint,
) {
  const { address: fromAddress } = await fetchStoredTonWallet(accountId);

  const backendState = await getBackendStakingState(accountId);
  const result = await ton.submitStake(
    accountId, password, amount, type, backendState!,
  );
  if ('error' in result) {
    return false;
  }

  ton.onStakingChangeExpected();

  const localTransaction = createLocalTransaction(accountId, 'ton', {
    amount: result.amount,
    fromAddress,
    toAddress: result.toAddress,
    comment: STAKE_COMMENT,
    fee: fee || 0n,
    type: 'stake',
    slug: TONCOIN.slug,
    inMsgHash: result.msgHash,
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
  amount: bigint,
  fee?: bigint,
) {
  const { address: fromAddress } = await fetchStoredTonWallet(accountId);

  const backendState = await ton.getBackendStakingState(accountId);
  const result = await ton.submitUnstake(accountId, password, type, amount, backendState!);
  if ('error' in result) {
    return false;
  }

  ton.onStakingChangeExpected();

  const localTransaction = createLocalTransaction(accountId, 'ton', {
    amount: result.amount,
    fromAddress,
    toAddress: result.toAddress,
    comment: UNSTAKE_COMMENT,
    fee: fee || 0n,
    type: 'unstakeRequest',
    slug: TONCOIN.slug,
    inMsgHash: result.msgHash,
  });

  return {
    ...result,
    txId: localTransaction.txId,
  };
}

export async function getStakingHistory(
  accountId: string,
  limit?: number,
  offset?: number,
): Promise<ApiStakingHistory> {
  const { address } = await fetchStoredTonWallet(accountId);
  return callBackendGet(`/staking/profits/${address}`, { limit, offset });
}

export async function tryUpdateStakingCommonData() {
  try {
    const data = await callBackendGet('/staking/common');
    data.round.start *= 1000;
    data.round.end *= 1000;
    data.round.unlock *= 1000;
    data.prevRound.start *= 1000;
    data.prevRound.end *= 1000;
    data.prevRound.unlock *= 1000;
    data.liquid.available = fromDecimal(data.liquid.available);

    setStakingCommonCache(data as ApiStakingCommonData);
  } catch (err) {
    logDebugError('tryUpdateLiquidStakingState', err);
  }
}

export async function getStakingState(accountId: string) {
  const backendState = await getBackendStakingState(accountId);
  const state = await chains.ton.getStakingState(accountId, backendState);

  return { backendState, state };
}

export function onStakingChangeExpected() {
  ton.onStakingChangeExpected();
}

export function fetchBackendStakingState(address: string) {
  return ton.getBackendStakingState(address);
}

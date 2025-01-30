import type {
  ApiJettonStakingState,
  ApiStakingCommonData,
  ApiStakingHistory,
  ApiStakingState,
  ApiTransactionActivity,
} from '../types';

import { TONCOIN } from '../../config';
import { fromDecimal } from '../../util/decimals';
import { logDebugError } from '../../util/logs';
import chains from '../chains';
import { fetchStoredTonWallet } from '../common/accounts';
import { callBackendGet } from '../common/backend';
import { setStakingCommonCache } from '../common/cache';
import { createLocalTransaction } from './transactions';

const { ton } = chains;

export function initStaking() {
}

export function checkStakeDraft(accountId: string, amount: bigint, state: ApiStakingState) {
  return ton.checkStakeDraft(accountId, amount, state);
}

export function checkUnstakeDraft(accountId: string, amount: bigint, state: ApiStakingState) {
  return ton.checkUnstakeDraft(accountId, amount, state);
}

export async function submitStake(
  accountId: string,
  password: string,
  amount: bigint,
  state: ApiStakingState,
  realFee?: bigint,
) {
  const { address: fromAddress } = await fetchStoredTonWallet(accountId);

  const result = await ton.submitStake(
    accountId, password, amount, state,
  );

  if ('error' in result) {
    return false;
  }

  let localTransaction: ApiTransactionActivity;

  if (state.tokenSlug === TONCOIN.slug) {
    localTransaction = createLocalTransaction(accountId, 'ton', {
      amount: result.amount,
      fromAddress,
      toAddress: result.toAddress,
      fee: realFee ?? 0n,
      type: 'stake',
      slug: state.tokenSlug,
      inMsgHash: result.msgHash,
    });
  } else {
    localTransaction = createLocalTransaction(accountId, 'ton', {
      amount,
      fromAddress,
      toAddress: result.toAddress,
      fee: realFee ?? 0n,
      type: 'stake',
      slug: state.tokenSlug,
    });
  }

  return {
    ...result,
    txId: localTransaction.txId,
  };
}

export async function submitUnstake(
  accountId: string,
  password: string,
  amount: bigint,
  state: ApiStakingState,
  realFee?: bigint,
) {
  const { address: fromAddress } = await fetchStoredTonWallet(accountId);

  const result = await ton.submitUnstake(accountId, password, amount, state);
  if ('error' in result) {
    return false;
  }

  const localTransaction = createLocalTransaction(accountId, 'ton', {
    amount: result.amount,
    fromAddress,
    toAddress: result.toAddress,
    fee: realFee ?? 0n,
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

export function fetchBackendStakingState(address: string) {
  return ton.getBackendStakingState(address);
}

export async function submitStakingClaim(
  accountId: string,
  password: string,
  state: ApiJettonStakingState,
  realFee?: bigint,
) {
  const { address: fromAddress } = await fetchStoredTonWallet(accountId);

  const result = await ton.submitStakingClaim(accountId, password, state);

  if ('error' in result) {
    return result;
  }

  const localTransaction = createLocalTransaction(accountId, 'ton', {
    amount: result.amount,
    fromAddress,
    toAddress: result.toAddress,
    fee: realFee ?? 0n,
    slug: TONCOIN.slug,
    inMsgHash: result.msgHash,
  });

  return {
    ...result,
    txId: localTransaction.txId,
  };
}

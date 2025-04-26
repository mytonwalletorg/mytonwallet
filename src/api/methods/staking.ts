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
import { fetchStoredAccount, fetchStoredTonWallet } from '../common/accounts';
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

  let localActivity: ApiTransactionActivity;

  if (state.tokenSlug === TONCOIN.slug) {
    localActivity = createLocalTransaction(accountId, 'ton', {
      txId: result.msgHashNormalized,
      amount,
      fromAddress,
      toAddress: result.toAddress,
      fee: realFee ?? 0n,
      type: 'stake',
      slug: state.tokenSlug,
      externalMsgHash: result.msgHash,
    });
  } else {
    localActivity = createLocalTransaction(accountId, 'ton', {
      txId: result.msgHashNormalized,
      amount,
      fromAddress,
      toAddress: result.toAddress,
      fee: realFee ?? 0n,
      type: 'stake',
      slug: state.tokenSlug,
      externalMsgHash: result.msgHash,
    });
  }

  return {
    ...result,
    txId: localActivity.txId,
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

  const localActivity = createLocalTransaction(accountId, 'ton', {
    txId: result.msgHashNormalized,
    amount: result.amount,
    fromAddress,
    toAddress: result.toAddress,
    fee: realFee ?? 0n,
    type: 'unstakeRequest',
    slug: TONCOIN.slug,
    externalMsgHash: result.msgHash,
  });

  return {
    ...result,
    txId: localActivity.txId,
  };
}

export async function getStakingHistory(
  accountId: string,
  limit?: number,
  offset?: number,
): Promise<ApiStakingHistory> {
  const { ton: tonWallet } = await fetchStoredAccount(accountId);
  if (!tonWallet) return [];
  return callBackendGet(`/staking/profits/${tonWallet.address}`, { limit, offset });
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

  const localActivity = createLocalTransaction(accountId, 'ton', {
    txId: result.msgHashNormalized,
    amount: result.amount,
    fromAddress,
    toAddress: result.toAddress,
    fee: realFee ?? 0n,
    slug: TONCOIN.slug,
    externalMsgHash: result.msgHash,
  });

  return {
    ...result,
    txId: localActivity.txId,
  };
}

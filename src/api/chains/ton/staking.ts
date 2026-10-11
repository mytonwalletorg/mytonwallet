import { Address } from '@ton/core';

import type {
  ApiBackendStakingState,
  ApiBalanceBySlug,
  ApiCheckTransactionDraftResult,
  ApiJettonStakingState,
  ApiNetwork,
  ApiStakingCommonData,
  ApiStakingCommonResponse,
  ApiStakingJettonPool,
  ApiStakingState,
  ApiSubmitGasfullTransferResult,
} from '../../types';
import type { StakingPoolConfigUnpacked } from './contracts/JettonStaking/StakingPool';
import type { TonTransferParams } from './types';
import { ApiLiquidUnstakeMode, ApiTransactionDraftError } from '../../types';

import {
  LIQUID_JETTON,
  LIQUID_POOL,
  TONCOIN,
  UNSTAKE_TON_GRACE_PERIOD,
  VALIDATION_PERIOD_MS,
} from '../../../config';
import { parseAccountId } from '../../../util/account';
import { bigintDivideToNumber, bigintMultiplyToNumber } from '../../../util/bigint';
import { fromDecimal } from '../../../util/decimals';
import { getDevSettings } from '../../../util/devSettings';
import { explainApiTransferFee } from '../../../util/fee/transferFee';
import { getNativeToken } from '../../../util/tokens';
import calcJettonStakingApr from '../../../util/ton/calcJettonStakingApr';
import {
  buildJettonClaimPayload,
  buildJettonUnstakePayload,
  buildLiquidStakingDepositBody,
  buildLiquidStakingWithdrawBody,
  getJettonPoolStakeWallet,
  getTonClient,
  resolveTokenWalletAddress,
  toBase64Address,
  unpackDicts,
} from './util/tonCore';
import { StakeWallet } from './contracts/JettonStaking/StakeWallet';
import { StakingPool } from './contracts/JettonStaking/StakingPool';
import { fetchStoredChainAccount, fetchStoredWallet } from '../../common/accounts';
import { callBackendGet } from '../../common/backend';
import { getAccountCache, getStakingCommonCache, updateAccountCache } from '../../common/cache';
import { buildTokenSlug, getTokenByAddress, getTokenBySlug } from '../../common/tokens';
import { TON_GAS } from './constants';
import { checkTransactionDraft, submitGasfullTransfer } from './transfer';

export async function checkStakeDraft(accountId: string, amount: bigint, state: ApiStakingState) {
  let result: ApiCheckTransactionDraftResult;

  switch (state.type) {
    case 'liquid': {
      result = await checkTransactionDraft({
        accountId,
        toAddress: LIQUID_POOL,
        amount: amount + TON_GAS.stakeLiquid,
        payload: buildLiquidStakingDepositBody(),
      });
      if (result.explainedFee?.fullFee?.nativeSum !== undefined) {
        const baseFee = result.explainedFee.fullFee.nativeSum;
        const baseRealFee = result.explainedFee.realFee?.nativeSum ?? baseFee;

        result.explainedFee = explainApiTransferFee({
          fee: baseFee + TON_GAS.stakeLiquid,
          realFee: baseRealFee + TON_GAS.stakeLiquid,
          tokenSlug: getNativeToken('ton').slug,
        });
      }
      break;
    }
    case 'jetton': {
      const { tokenSlug, pool, period } = state;
      const { tokenAddress } = getTokenBySlug(tokenSlug)!;

      result = await checkTransactionDraft({
        accountId,
        toAddress: pool,
        tokenAddress,
        amount,
        payload: StakingPool.stakePayload(period),
        forwardAmount: TON_GAS.stakeJettonsForward,
      });
      break;
    }
  }

  return result;
}

export async function checkUnstakeDraft(
  accountId: string,
  amount: bigint, // The amount that the user sees
  state: ApiStakingState,
) {
  const { network } = parseAccountId(accountId);
  const { address } = await fetchStoredWallet(accountId, 'ton');
  const commonData = await getStakingCommonCache('ton');

  let result: ApiCheckTransactionDraftResult;
  let tokenAmount: bigint | undefined;

  switch (state.type) {
    case 'liquid': {
      if (amount > state.balance) {
        return { error: ApiTransactionDraftError.InsufficientBalance };
      } else if (amount === state.balance) {
        tokenAmount = state.tokenBalance;
      } else {
        tokenAmount = bigintDivideToNumber(amount, commonData.liquid.currentRate);
      }

      const params = await buildLiquidStakingWithdraw(network, address, tokenAmount);

      result = await checkTransactionDraft({
        accountId,
        toAddress: params.toAddress,
        amount: params.amount,
        payload: params.payload,
      });
      break;
    }
    case 'jetton': {
      tokenAmount = amount;

      result = await checkTransactionDraft({
        accountId,
        toAddress: state.stakeWalletAddress,
        amount: TON_GAS.unstakeJettons,
        payload: buildJettonUnstakePayload(amount, true),
      });
      break;
    }
  }

  return {
    ...result,
    type: state.type,
    tokenAmount,
  };
}

export async function submitStake(
  accountId: string,
  enclaveToken: string | undefined,
  amount: bigint,
  state: ApiStakingState,
) {
  let result: ApiSubmitGasfullTransferResult | { error: string };
  let toAddress: string;

  const { address } = await fetchStoredWallet(accountId, 'ton');

  switch (state.type) {
    case 'liquid': {
      toAddress = LIQUID_POOL;
      result = await submitGasfullTransfer({
        accountId,
        enclaveToken,
        toAddress,
        amount: amount + TON_GAS.stakeLiquid,
        payload: buildLiquidStakingDepositBody(),
      });
      break;
    }
    case 'jetton': {
      const { tokenSlug, pool, period } = state;
      const { tokenAddress } = getTokenBySlug(tokenSlug)!;
      toAddress = pool;

      result = await submitGasfullTransfer({
        accountId,
        enclaveToken,
        toAddress,
        tokenAddress,
        amount,
        payload: StakingPool.stakePayload(period),
        forwardAmount: TON_GAS.stakeJettonsForward,
      });
      break;
    }
  }

  if ('error' in result) {
    return result;
  }

  updateAccountCache(accountId, address, { stakedAt: Date.now() });

  return {
    ...result,
    localActivityParams: {
      ...result.localActivityParams,
      toAddress,
    },
  };
}

export async function submitUnstake(
  accountId: string,
  enclaveToken: string | undefined,
  amount: bigint, // Token amount (not the amount that the user sees)
  state: ApiStakingState,
) {
  const { network } = parseAccountId(accountId);
  const { address } = await fetchStoredWallet(accountId, 'ton');

  let result: ApiSubmitGasfullTransferResult | { error: string };
  let toAddress: string;
  const tokenSlug: string = TONCOIN.slug;

  switch (state.type) {
    case 'liquid': {
      const mode = !state.instantAvailable
        ? ApiLiquidUnstakeMode.BestRate
        : ApiLiquidUnstakeMode.Default;

      const params = await buildLiquidStakingWithdraw(network, address, amount, mode);

      toAddress = params.toAddress;
      result = await submitGasfullTransfer({
        accountId,
        enclaveToken,
        toAddress,
        amount: params.amount,
        payload: params.payload,
      });
      break;
    }
    case 'jetton': {
      toAddress = state.stakeWalletAddress;
      result = await submitGasfullTransfer({
        accountId,
        enclaveToken,
        toAddress,
        amount: TON_GAS.unstakeJettons,
        payload: buildJettonUnstakePayload(amount, true),
      });
      break;
    }
  }

  if ('error' in result) {
    return result;
  }

  return {
    ...result,
    localActivityParams: {
      ...result.localActivityParams,
      toAddress,
      slug: tokenSlug,
    },
  };
}

export async function buildLiquidStakingWithdraw(
  network: ApiNetwork,
  address: string,
  amount: bigint,
  mode: ApiLiquidUnstakeMode = ApiLiquidUnstakeMode.Default,
): Promise<TonTransferParams> {
  const tokenWalletAddress = await resolveTokenWalletAddress(network, address, LIQUID_JETTON);

  const payload = buildLiquidStakingWithdrawBody({
    amount,
    responseAddress: address,
    fillOrKill: mode === ApiLiquidUnstakeMode.Instant,
    waitTillRoundEnd: mode === ApiLiquidUnstakeMode.BestRate,
  });

  return {
    amount: TON_GAS.unstakeLiquid,
    toAddress: tokenWalletAddress,
    payload,
  };
}

type StakingStateOptions = {
  accountId: string;
  backendState: ApiBackendStakingState;
  commonData: ApiStakingCommonData;
  address: string;
  network: ApiNetwork;
  balances: ApiBalanceBySlug;
};

export async function getStakingStates(
  accountId: string,
  commonData: ApiStakingCommonData,
  backendState: ApiBackendStakingState,
  balances: ApiBalanceBySlug,
): Promise<ApiStakingState[]> {
  const { network } = parseAccountId(accountId);
  const { address } = await fetchStoredWallet(accountId, 'ton');

  const options: StakingStateOptions = {
    accountId,
    backendState,
    commonData,
    address,
    network,
    balances,
  };

  const promises: Promise<ApiStakingState>[] = [];

  for (const poolConfig of commonData.jettonPools) {
    const slug = buildTokenSlug('ton', poolConfig.token);
    if (slug in balances) {
      promises.push(buildJettonState(options, poolConfig));
    }
  }

  return [buildLiquidState(options), ...await Promise.all(promises)];
}

function buildLiquidState({
  accountId,
  address,
  backendState,
  commonData,
  balances,
}: StakingStateOptions): ApiStakingState {
  const { currentRate } = commonData.liquid;
  const tokenSlug = buildTokenSlug('ton', LIQUID_JETTON);
  const tokenBalance = balances[tokenSlug] ?? 0n;
  const unstakeRequestAmount = fromDecimal(backendState.liquid?.unstakeRequestAmount ?? 0);

  const accountCache = getAccountCache(accountId, address);
  const stakedAt = Math.max(accountCache.stakedAt ?? 0, backendState.stakedAt ?? 0);

  const isInstantUnstake = Date.now() - stakedAt > VALIDATION_PERIOD_MS && !getDevSettings().simulateLongUnstaking;
  const liquidAvailable = isInstantUnstake ? commonData.liquid.available : 0n;
  const { start, end } = getLiquidStakingTimeRange(commonData);

  const balance = bigintMultiplyToNumber(tokenBalance, currentRate) + unstakeRequestAmount;

  return {
    type: 'liquid',
    id: 'liquid',
    tokenSlug: TONCOIN.slug,
    pool: LIQUID_POOL,
    balance,
    annualYield: commonData.liquid.apy,
    yieldType: 'APY',
    tokenBalance,
    tvl: commonData.liquid.tvl,
    totalStakers: commonData.liquid.totalStakers,
    unstakeRequestAmount,
    instantAvailable: liquidAvailable,
    start,
    end,
  };
}

async function buildJettonState(
  options: StakingStateOptions,
  pool: ApiStakingJettonPool,
): Promise<ApiJettonStakingState> {
  const { network } = options;

  // common
  const {
    pool: poolAddress,
    token: tokenAddress,
    poolConfig,
  } = pool;

  const { decimals, slug: tokenSlug } = getTokenByAddress(tokenAddress)!;

  // pool
  const { tvl, rewardJettons } = unpackDicts(poolConfig) as StakingPoolConfigUnpacked;
  const { rewardsDeposits } = Object.values(rewardJettons!)[0];
  const now = Math.floor(Date.now() / 1000);

  let dailyReward: bigint = 0n;
  for (const { startTime, endTime, distributionSpeed } of Object.values(rewardsDeposits)) {
    if (startTime < now && endTime > now) {
      dailyReward += distributionSpeed;
    }
  }

  const apr = calcJettonStakingApr({ tvl, dailyReward, decimals });

  // wallet
  const { address, balances } = options;
  const periodConfig = pool.periods[0];
  const stakedTokenSlug = buildTokenSlug('ton', periodConfig.token);

  const stakeWallet = await getJettonPoolStakeWallet(network, poolAddress, periodConfig.period, address);

  let unclaimedRewards = 0n;
  let balance = 0n;
  let poolWallets: string[] | undefined;

  if (stakedTokenSlug in balances) { // Avoiding the request when it's unnecessary
    const walletData = await stakeWallet.getStorageData().catch(() => undefined);

    if (walletData) {
      const poolWalletAddress = await resolveTokenWalletAddress(network, poolAddress, tokenAddress);
      const rewards = StakeWallet.getAvailableRewards(walletData, poolConfig);
      unclaimedRewards = (rewards && rewards[poolWalletAddress]) ?? 0n;
      balance = walletData.jettonBalance;
      poolWallets = Object.keys(rewards);
    }
  }

  const state: ApiJettonStakingState = {
    type: 'jetton',
    id: poolAddress,
    pool: poolAddress,
    tokenAddress,
    tokenSlug,
    annualYield: apr,
    yieldType: 'APR',
    balance,
    unclaimedRewards,
    poolWallets,
    stakeWalletAddress: toBase64Address(stakeWallet.address, true),
    tokenAmount: 0n,
    tvl,
    dailyReward,
    period: periodConfig.period,
  };

  return state;
}

function getLiquidStakingTimeRange(commonData: ApiStakingCommonData) {
  const { prevRound, round: currentRound } = commonData;
  const now = Date.now();
  const gracePeriod = UNSTAKE_TON_GRACE_PERIOD;

  const round = (
    // Show date of next unlock plus few minutes
    // (except when grace period is active and payout has already occurred — i.e. collection has disappeared).
    (now > prevRound.unlock && now < prevRound.unlock + gracePeriod && !commonData.liquid.collection)
    || now >= prevRound.unlock + gracePeriod
  ) ? currentRound : prevRound;

  return {
    start: round.start,
    end: round.unlock + gracePeriod,
  };
}

export async function getBackendStakingState(accountId: string): Promise<ApiBackendStakingState> {
  const account = await fetchStoredChainAccount(accountId, 'ton');
  return callBackendGet<ApiBackendStakingState>(`/staking/state/${account.byChain.ton.address}`);
}

export async function submitTokenStakingClaim(
  accountId: string,
  enclaveToken: string | undefined,
  state: ApiJettonStakingState,
) {
  const toAddress = state.stakeWalletAddress;
  const amount = TON_GAS.claimJettons;
  const result = await submitGasfullTransfer({
    accountId,
    enclaveToken,
    toAddress,
    amount,
    payload: buildJettonClaimPayload(state.poolWallets!),
  });

  if ('error' in result) {
    return result;
  }

  return {
    ...result,
    localActivityParams: {
      ...result.localActivityParams,
      toAddress,
      amount,
      slug: TONCOIN.slug,
    },
  };
}

export async function getStakingCommonData(): Promise<ApiStakingCommonData> {
  const tonClient = getTonClient('mainnet');
  const response = await callBackendGet<ApiStakingCommonResponse>('/staking/common');

  const data: ApiStakingCommonData = {
    ...response,
    liquid: {
      ...response.liquid,
      available: fromDecimal(response.liquid.available),
      tvl: fromDecimal(response.liquid.tvl),
    },
    jettonPools: await Promise.all(response.jettonPools.map(async (pool) => {
      const poolContract = tonClient.open(StakingPool.createFromAddress(Address.parse(pool.pool)));
      const poolConfig = await poolContract.getStorageData();
      return {
        ...pool,
        poolConfig,
      };
    })),
  };
  data.round.start *= 1000;
  data.round.end *= 1000;
  data.round.unlock *= 1000;
  data.prevRound.start *= 1000;
  data.prevRound.end *= 1000;
  data.prevRound.unlock *= 1000;

  return data;
}

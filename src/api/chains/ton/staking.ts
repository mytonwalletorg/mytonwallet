import { Address } from '@ton/core';

import type {
  ApiBackendStakingState,
  ApiNetwork,
  ApiStakingState,
  ApiStakingType,
} from '../../types';
import type { ApiCheckTransactionDraftResult, ApiSubmitTransferTonResult, TonTransferParams } from './types';
import { ApiCommonError, ApiLiquidUnstakeMode, ApiTransactionDraftError } from '../../types';

import {
  APP_ENV,
  APP_VERSION,
  LIQUID_JETTON,
  LIQUID_POOL,
  ONE_TON,
  VALIDATION_PERIOD_MS,
} from '../../../config';
import { parseAccountId } from '../../../util/account';
import { bigintDivideToNumber, bigintMultiplyToNumber } from '../../../util/bigint';
import { fromDecimal } from '../../../util/decimals';
import {
  buildLiquidStakingDepositBody,
  buildLiquidStakingWithdrawBody,
  getTokenBalance,
  getTonClient,
  resolveTokenWalletAddress,
  toBase64Address,
} from './util/tonCore';
import { NominatorPool } from './contracts/NominatorPool';
import { fetchStoredTonWallet } from '../../common/accounts';
import { callBackendGet } from '../../common/backend';
import { getAccountCache, getStakingCommonCache, updateAccountCache } from '../../common/cache';
import { getClientId } from '../../common/other';
import { isKnownStakingPool } from '../../common/utils';
import { nftRepository } from '../../db';
import { getEnvironment } from '../../environment';
import { STAKE_COMMENT, UNSTAKE_COMMENT } from './constants';
import { checkTransactionDraft, submitTransfer } from './transactions';
import { isAddressInitialized } from './wallet';

const CACHE_TTL = 5000; // 5 s.
let backendStakingStateByAddress: Record<string, [number, ApiBackendStakingState]> = {};

export async function checkStakeDraft(
  accountId: string,
  amount: bigint,
  backendState: ApiBackendStakingState,
) {
  const staked = await getStakingState(accountId, backendState);

  let type: ApiStakingType;
  let result: ApiCheckTransactionDraftResult;

  if (staked?.type === 'nominators' && amount >= ONE_TON) {
    type = 'nominators';

    const poolAddress = backendState.nominatorsPool.address;
    amount += ONE_TON;

    result = await checkTransactionDraft({
      accountId,
      toAddress: poolAddress,
      amount,
      data: STAKE_COMMENT,
    });
  } else if (amount < ONE_TON) {
    return { error: ApiTransactionDraftError.InvalidAmount };
  } else {
    type = 'liquid';

    const body = buildLiquidStakingDepositBody();
    result = await checkTransactionDraft({
      accountId,
      toAddress: LIQUID_POOL,
      amount,
      data: body,
    });
  }

  return {
    ...result,
    type,
  };
}

export async function checkUnstakeDraft(
  accountId: string,
  amount: bigint,
  backendState: ApiBackendStakingState,
) {
  const { network } = parseAccountId(accountId);
  const { address } = await fetchStoredTonWallet(accountId);
  const commonData = getStakingCommonCache();
  const staked = await getStakingState(accountId, backendState);

  let type: ApiStakingType;
  let result: ApiCheckTransactionDraftResult;
  let tokenAmount: bigint | undefined;

  if (staked.type === 'nominators') {
    type = 'nominators';

    const poolAddress = backendState.nominatorsPool.address;
    result = await checkTransactionDraft({
      accountId,
      toAddress: poolAddress,
      amount: ONE_TON,
      data: UNSTAKE_COMMENT,
    });
  } else if (staked.type === 'liquid') {
    type = 'liquid';

    if (amount > staked.amount) {
      return { error: ApiTransactionDraftError.InsufficientBalance };
    } else if (amount === staked.amount) {
      tokenAmount = staked.tokenAmount;
    } else {
      tokenAmount = bigintDivideToNumber(amount, commonData.liquid.currentRate);
    }

    const params = await buildLiquidStakingWithdraw(network, address, tokenAmount);
    result = await checkTransactionDraft({
      accountId,
      toAddress: params.toAddress,
      amount: params.amount,
      data: params.payload,
    });
  } else {
    return { error: ApiCommonError.Unexpected };
  }

  return {
    ...result,
    type,
    tokenAmount,
  };
}

export async function submitStake(
  accountId: string,
  password: string,
  amount: bigint,
  type: ApiStakingType,
  backendState: ApiBackendStakingState,
) {
  let result: ApiSubmitTransferTonResult;

  const { network } = parseAccountId(accountId);
  const { address } = await fetchStoredTonWallet(accountId);

  if (type === 'liquid') {
    amount += ONE_TON;
    result = await submitTransfer({
      accountId,
      password,
      toAddress: LIQUID_POOL,
      amount,
      data: buildLiquidStakingDepositBody(),
    });
  } else {
    const poolAddress = backendState.nominatorsPool.address;
    result = await submitTransfer({
      accountId,
      password,
      toAddress: toBase64Address(poolAddress, true, network),
      amount,
      data: STAKE_COMMENT,
    });
  }

  if (!('error' in result)) {
    updateAccountCache(accountId, address, { stakedAt: Date.now() });
  }

  return result;
}

export async function submitUnstake(
  accountId: string,
  password: string,
  type: ApiStakingType,
  amount: bigint,
  backendState: ApiBackendStakingState,
) {
  const { network } = parseAccountId(accountId);
  const { address } = await fetchStoredTonWallet(accountId);

  const staked = await getStakingState(accountId, backendState);

  let result: ApiSubmitTransferTonResult;

  if (type === 'liquid') {
    const mode = staked.type === 'liquid' && !staked.instantAvailable
      ? ApiLiquidUnstakeMode.BestRate
      : ApiLiquidUnstakeMode.Default;

    const params = await buildLiquidStakingWithdraw(network, address, amount, mode);

    result = await submitTransfer({
      accountId,
      password,
      toAddress: params.toAddress,
      amount: params.amount,
      data: params.payload,
    });
  } else {
    const poolAddress = backendState.nominatorsPool.address;
    result = await submitTransfer({
      accountId,
      password,
      toAddress: toBase64Address(poolAddress, true, network),
      amount: ONE_TON,
      data: UNSTAKE_COMMENT,
    });
  }

  return result;
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
    amount: ONE_TON,
    toAddress: tokenWalletAddress,
    payload,
  };
}

export async function getStakingState(
  accountId: string,
  backendState: ApiBackendStakingState,
): Promise<ApiStakingState> {
  const commonData = getStakingCommonCache();
  const { network } = parseAccountId(accountId);
  const { address } = await fetchStoredTonWallet(accountId);

  const { currentRate, collection } = commonData.liquid;
  const tokenBalance = await getLiquidStakingTokenBalance(accountId);
  let unstakeAmount = 0n;

  if (collection) {
    const nfts = await nftRepository.find({
      accountId,
      collectionAddress: collection,
    });

    for (const nft of nfts ?? []) {
      const billAmount = nft.name?.match(/Bill for (?<amount>[\d.]+) Pool Jetton/)?.groups?.amount;
      if (billAmount) {
        unstakeAmount += fromDecimal(billAmount);
      }
    }
  }

  const { loyaltyType, shouldUseNominators } = backendState;

  const accountCache = getAccountCache(accountId, address);
  const stakedAt = Math.max(accountCache.stakedAt ?? 0, backendState.stakedAt ?? 0);

  const isInstantUnstake = Date.now() - stakedAt > VALIDATION_PERIOD_MS;
  const liquidAvailable = isInstantUnstake ? commonData.liquid.available : 0n;

  let liquidApy = commonData.liquid.apy;
  if (loyaltyType && loyaltyType in commonData.liquid.loyaltyApy) {
    liquidApy = commonData.liquid.loyaltyApy[loyaltyType];
  }

  if (tokenBalance > 0n || unstakeAmount > 0n) {
    const fullTokenAmount = tokenBalance + unstakeAmount;
    const amount = bigintMultiplyToNumber(fullTokenAmount, currentRate);

    return {
      type: 'liquid',
      tokenAmount: tokenBalance,
      amount,
      unstakeRequestAmount: unstakeAmount,
      apy: liquidApy,
      instantAvailable: liquidAvailable,
    };
  }

  const poolAddress = backendState.nominatorsPool.address;

  if (backendState.type === 'nominators') {
    const nominatorPool = getPoolContract(network, poolAddress);
    const nominators = await nominatorPool.getListNominators();
    const addressObject = Address.parse(address);
    const currentNominator = nominators.find((n) => n.address.equals(addressObject));

    if (currentNominator) {
      return {
        type: 'nominators',
        amount: backendState.balance,
        pendingDepositAmount: currentNominator.pendingDepositAmount,
        isUnstakeRequested: currentNominator.withdrawRequested,
      };
    }
  }

  if (shouldUseNominators) {
    return {
      type: 'nominators',
      amount: 0n,
      pendingDepositAmount: 0n,
      isUnstakeRequested: false,
    };
  } else {
    return {
      type: 'liquid',
      tokenAmount: 0n,
      amount: 0n,
      unstakeRequestAmount: 0n,
      apy: liquidApy,
      instantAvailable: liquidAvailable,
    };
  }
}

function getPoolContract(network: ApiNetwork, poolAddress: string) {
  return getTonClient(network).open(new NominatorPool(Address.parse(poolAddress)));
}

async function getLiquidStakingTokenBalance(accountId: string) {
  const { network } = parseAccountId(accountId);
  if (network !== 'mainnet') {
    return 0n;
  }

  const { address } = await fetchStoredTonWallet(accountId);
  const walletAddress = await resolveTokenWalletAddress(network, address, LIQUID_JETTON);
  const isInitialized = await isAddressInitialized(network, walletAddress);

  if (!isInitialized) {
    return 0n;
  }

  return getTokenBalance(network, walletAddress);
}

export async function getBackendStakingState(accountId: string): Promise<ApiBackendStakingState> {
  const { address } = await fetchStoredTonWallet(accountId);
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

  const headers: AnyLiteral = {
    ...getEnvironment().apiHeaders,
    'X-App-Version': APP_VERSION,
    'X-App-ClientID': await getClientId(),
    'X-App-Env': APP_ENV,
  };

  const stakingState = await callBackendGet(`/staking/state/${address}`, undefined, headers);
  stakingState.balance = fromDecimal(stakingState.balance);
  stakingState.totalProfit = fromDecimal(stakingState.totalProfit);

  if (!isKnownStakingPool(stakingState.nominatorsPool.address)) {
    throw Error('Unexpected pool address, likely a malicious activity');
  }

  backendStakingStateByAddress[address] = [Date.now() + CACHE_TTL, stakingState];

  return stakingState;
}

export function onStakingChangeExpected() {
  backendStakingStateByAddress = {};
}

import BN from 'bn.js';

import type {
  ApiBackendStakingState,
  ApiNetwork,
  ApiStakingCommonData,
  ApiStakingState,
  ApiStakingType,
} from '../../types';
import type { CheckTransactionDraftResult, SubmitTransferResult } from './transactions';
import type { TonTransferParams } from './types';
import { ApiCommonError, ApiLiquidUnstakeMode, ApiTransactionDraftError } from '../../types';

import {
  LIQUID_JETTON, LIQUID_POOL, STAKING_MIN_AMOUNT, TON_TOKEN_SLUG,
} from '../../../config';
import { Big } from '../../../lib/big.js';
import { parseAccountId } from '../../../util/account';
import {
  buildLiquidStakingDepositBody,
  buildLiquidStakingWithdrawBody,
  fromNano,
  getTokenBalance,
  getTonWeb,
  resolveTokenWalletAddress,
  toBase64Address,
  toNano,
} from './util/tonweb';
import { NominatorPool } from './contracts/NominatorPool';
import { fetchStoredAddress } from '../../common/accounts';
import { apiDb } from '../../db';
import { DEFAULT_DECIMALS, STAKE_COMMENT, UNSTAKE_COMMENT } from './constants';
import { checkTransactionDraft, submitTransfer } from './transactions';
import { isAddressInitialized } from './wallet';

const LIQUID_STAKE_AMOUNT = '1';
const LIQUID_UNSTAKE_AMOUNT = '1';
const UNSTAKE_AMOUNT = '1';

export async function checkStakeDraft(
  accountId: string,
  amount: string,
  commonData: ApiStakingCommonData,
  backendState: ApiBackendStakingState,
) {
  const staked = await getStakingState(accountId, commonData, backendState);

  let type: ApiStakingType;
  let result: CheckTransactionDraftResult;
  const bigAmount = Big(fromNano(amount));

  if (staked?.type === 'nominators' && bigAmount.gte(STAKING_MIN_AMOUNT)) {
    type = 'nominators';

    const poolAddress = backendState.nominatorsPool.address;
    amount = new BN(amount).add(toNano(LIQUID_STAKE_AMOUNT)).toString();
    result = await checkTransactionDraft(accountId, TON_TOKEN_SLUG, poolAddress, amount, STAKE_COMMENT);
  } else if (bigAmount.lt(STAKING_MIN_AMOUNT)) {
    return { error: ApiTransactionDraftError.InvalidAmount };
  } else {
    type = 'liquid';

    const body = buildLiquidStakingDepositBody();
    result = await checkTransactionDraft(accountId, TON_TOKEN_SLUG, LIQUID_POOL, amount, body);
  }

  return {
    ...result,
    type,
  };
}

export async function checkUnstakeDraft(
  accountId: string,
  amount: string,
  commonData: ApiStakingCommonData,
  backendState: ApiBackendStakingState,
) {
  const { network } = parseAccountId(accountId);
  const address = await fetchStoredAddress(accountId);
  const staked = await getStakingState(accountId, commonData, backendState);

  let type: ApiStakingType;
  let result: CheckTransactionDraftResult;
  let tokenAmount: string | undefined;

  if (staked.type === 'nominators') {
    type = 'nominators';

    const poolAddress = backendState.nominatorsPool.address;
    result = await checkTransactionDraft(
      accountId, TON_TOKEN_SLUG, poolAddress, toNano(UNSTAKE_AMOUNT).toString(), UNSTAKE_COMMENT,
    );
  } else if (staked.type === 'liquid') {
    type = 'liquid';

    const bigAmount = Big(fromNano(amount).toString());
    if (bigAmount.gt(staked.amount)) {
      return { error: ApiTransactionDraftError.InsufficientBalance };
    } else if (bigAmount.eq(staked.amount)) {
      tokenAmount = staked.tokenAmount;
    } else {
      const { currentRate } = commonData.liquid;
      tokenAmount = bigAmount.div(currentRate).toFixed(DEFAULT_DECIMALS);
    }

    tokenAmount = toNano(tokenAmount).toString();

    const params = await buildLiquidStakingWithdraw(network, address, tokenAmount);
    result = await checkTransactionDraft(
      accountId, TON_TOKEN_SLUG, params.toAddress, params.amount, params.payload,
    );
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
  amount: string,
  type: ApiStakingType,
  backendState: ApiBackendStakingState,
) {
  let result: SubmitTransferResult;

  if (type === 'liquid') {
    amount = new BN(amount).add(toNano(LIQUID_STAKE_AMOUNT)).toString();
    result = await submitTransfer(
      accountId,
      password,
      TON_TOKEN_SLUG,
      LIQUID_POOL,
      amount,
      buildLiquidStakingDepositBody(),
    );
  } else {
    const poolAddress = backendState.nominatorsPool.address;
    result = await submitTransfer(
      accountId,
      password,
      TON_TOKEN_SLUG,
      toBase64Address(poolAddress, true),
      amount,
      STAKE_COMMENT,
    );
  }

  return result;
}

export async function submitUnstake(
  accountId: string,
  password: string,
  type: ApiStakingType,
  amount: string,
  backendState: ApiBackendStakingState,
) {
  const { network } = parseAccountId(accountId);
  const address = await fetchStoredAddress(accountId);

  let result: SubmitTransferResult;

  if (type === 'liquid') {
    const params = await buildLiquidStakingWithdraw(network, address, amount);
    result = await submitTransfer(
      accountId,
      password,
      TON_TOKEN_SLUG,
      params.toAddress,
      params.amount,
      params.payload,
    );
  } else {
    const poolAddress = backendState.nominatorsPool.address;
    result = await submitTransfer(
      accountId,
      password,
      TON_TOKEN_SLUG,
      toBase64Address(poolAddress, true),
      toNano(UNSTAKE_AMOUNT).toString(),
      UNSTAKE_COMMENT,
    );
  }

  return result;
}

export async function buildLiquidStakingWithdraw(
  network: ApiNetwork,
  address: string,
  amount: string,
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
    amount: toNano(LIQUID_UNSTAKE_AMOUNT).toString(),
    toAddress: tokenWalletAddress,
    payload,
  };
}

export async function getStakingState(
  accountId: string,
  commonData: ApiStakingCommonData,
  backendState: ApiBackendStakingState,
): Promise<ApiStakingState> {
  const { network } = parseAccountId(accountId);
  const address = toBase64Address(await fetchStoredAddress(accountId), true);

  const { currentRate, collection } = commonData.liquid;
  const tokenBalance = Big(await getLiquidStakingTokenBalance(accountId));
  let unstakeAmount = Big(0);

  if (collection) {
    const nfts = await apiDb.nfts.where({
      accountId,
      collectionAddress: collection,
    }).toArray();

    for (const nft of nfts) {
      const billAmount = nft.name?.match(/Bill for (?<amount>[\d.]+) Pool Jetton/)?.groups?.amount;
      unstakeAmount = unstakeAmount.plus(billAmount ?? 0);
    }
  }

  const { loyaltyType } = backendState;

  const liquidAvailable = commonData.liquid.collection ? '0' : commonData.liquid.available;
  let liquidApy = commonData.liquid.apy;
  if (loyaltyType && loyaltyType in commonData.liquid.loyaltyApy) {
    liquidApy = commonData.liquid.loyaltyApy[loyaltyType];
  }

  if (tokenBalance.gt(0) || unstakeAmount.gt(0)) {
    const fullTokenAmount = tokenBalance.plus(unstakeAmount);
    const amount = Big(currentRate).times(fullTokenAmount).toFixed(DEFAULT_DECIMALS);

    return {
      type: 'liquid',
      tokenAmount: tokenBalance.toFixed(DEFAULT_DECIMALS),
      amount: parseFloat(amount),
      unstakeRequestAmount: unstakeAmount.toNumber(),
      apy: liquidApy,
      instantAvailable: liquidAvailable,
    };
  }

  const poolAddress = backendState.nominatorsPool.address;
  const nominatorPool = getPoolContract(network, poolAddress);
  const nominators = await nominatorPool.getListNominators();
  const currentNominator = nominators.find((n) => n.address === address);

  if (!currentNominator) {
    return {
      type: 'liquid',
      tokenAmount: '0',
      amount: 0,
      unstakeRequestAmount: 0,
      apy: liquidApy,
      instantAvailable: liquidAvailable,
    };
  }

  return {
    type: 'nominators',
    amount: parseFloat(currentNominator.amount),
    pendingDepositAmount: parseFloat(currentNominator.pendingDepositAmount),
    isUnstakeRequested: currentNominator.withdrawRequested,
  };
}

function getPoolContract(network: ApiNetwork, poolAddress: string) {
  return new NominatorPool(getTonWeb(network).provider, { address: poolAddress });
}

async function getLiquidStakingTokenBalance(accountId: string) {
  const { network } = parseAccountId(accountId);
  if (network !== 'mainnet') {
    return '0';
  }

  const address = await fetchStoredAddress(accountId);
  const walletAddress = await resolveTokenWalletAddress(network, address, LIQUID_JETTON);
  const isInitialized = await isAddressInitialized(network, walletAddress);

  if (!isInitialized) {
    return '0';
  }

  return getTokenBalance(network, walletAddress);
}

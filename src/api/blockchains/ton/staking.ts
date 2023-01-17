import TonWeb from 'tonweb';
import BN from 'bn.js';
import { checkTransactionDraft, submitTransfer } from './transactions';
import { Storage } from '../../storages/types';
import { handleFetchErrors } from '../../common/utils';
import {
  BRILLIANT_API_BASE_URL,
  STAKING_POOL_1_MAINNET,
  STAKING_POOL_1_TESTNET,
  STAKING_POOL_2_MAINNET,
  STAKING_POOL_2_TESTNET,
  TON_TOKEN_SLUG,
} from '../../../config';
import { fetchAddress } from './address';
import { NominatorPool } from './contracts/NominatorPool';
import { getTonWeb } from './util/tonweb';
import { parseAccountId } from '../../../util/account';
import {
  ApiNetwork,
  ApiStakingState,
  ApiPoolState,
  ApiTransactionDraftError,
} from '../../types';
import { STAKE_COMMENT, UNSTAKE_COMMENT } from './constants';

const { Address, toNano } = TonWeb.utils;

const ONE_TON = '1000000000';
const UNSTAKE_AMOUNT = ONE_TON;

type StakingPoolId = '1' | '2';

interface StakingPool {
  address: string;
  maxDepositors: number;
  minStakeAmount: number;
  metadata?: any;
}

const POOLS_BY_NETWORK: Record<ApiNetwork, Record<StakingPoolId, StakingPool>> = {
  mainnet: {
    1: {
      address: STAKING_POOL_1_MAINNET,
      maxDepositors: 40,
      minStakeAmount: 10001,
    },
    2: {
      address: STAKING_POOL_2_MAINNET,
      maxDepositors: 40,
      minStakeAmount: 10001,
    },
  },
  testnet: {
    1: {
      address: STAKING_POOL_1_TESTNET,
      maxDepositors: 40,
      minStakeAmount: 10001,
    },
    2: {
      address: STAKING_POOL_2_TESTNET,
      maxDepositors: 40,
      minStakeAmount: 10001,
    },
  },
};

export async function checkStakeDraft(storage: Storage, accountId: string, amount: string) {
  const { network } = parseAccountId(accountId);
  const address = await fetchAddress(storage, accountId);
  const {
    address: poolAddress,
    minStakeAmount,
  } = resolveWalletPool(network, address);

  const result: {
    error?: ApiTransactionDraftError;
    fee?: string;
  } = {};

  const staked = await getStakingState(storage, accountId);
  if (!staked) {
    if (new BN(amount).lt(toNano(minStakeAmount.toString()))) {
      result.error = ApiTransactionDraftError.InvalidAmount;
      return result;
    }
  }

  return checkTransactionDraft(
    storage,
    accountId,
    TON_TOKEN_SLUG,
    poolAddress,
    amount,
    STAKE_COMMENT,
  );
}

export async function checkUnstakeDraft(storage: Storage, accountId: string) {
  const { network } = parseAccountId(accountId);
  const address = await fetchAddress(storage, accountId);
  const { address: poolAddress } = resolveWalletPool(network, address);
  return checkTransactionDraft(
    storage,
    accountId,
    TON_TOKEN_SLUG,
    poolAddress,
    UNSTAKE_AMOUNT,
    UNSTAKE_COMMENT,
  );
}

export async function submitStake(storage: Storage, accountId: string, password: string, amount: string) {
  const { network } = parseAccountId(accountId);
  const address = await fetchAddress(storage, accountId);
  const { address: poolAddress } = resolveWalletPool(network, address);
  return submitTransfer(
    storage,
    accountId,
    password,
    TON_TOKEN_SLUG,
    poolAddress,
    amount,
    STAKE_COMMENT,
  );
}

export async function submitUnstake(storage: Storage, accountId: string, password: string) {
  const { network } = parseAccountId(accountId);
  const address = await fetchAddress(storage, accountId);
  const { address: poolAddress } = resolveWalletPool(network, address);
  return submitTransfer(
    storage,
    accountId,
    password,
    TON_TOKEN_SLUG,
    poolAddress,
    UNSTAKE_AMOUNT,
    UNSTAKE_COMMENT,
  );
}

export async function getStakingState(storage: Storage, accountId: string): Promise<ApiStakingState> {
  const { network } = parseAccountId(accountId);
  const address = await fetchAddress(storage, accountId);
  const contract = getPoolContract(network, address);
  if (!contract) {
    return {
      amount: 0,
      pendingDepositAmount: 0,
      isUnstakeRequested: false,
    };
  }

  const nominators = await contract.getListNominators();
  const currentNominator = nominators.find((n) => n.address === address);
  if (!currentNominator) {
    return {
      amount: 0,
      pendingDepositAmount: 0,
      isUnstakeRequested: false,
    };
  }

  return {
    amount: parseFloat(currentNominator.amount),
    pendingDepositAmount: parseFloat(currentNominator.pendingDepositAmount),
    isUnstakeRequested: currentNominator.withdrawRequested,
  };
}

export async function getPoolState(storage: Storage, accountId: string) {
  const { network } = parseAccountId(accountId);
  const address = await fetchAddress(storage, accountId);
  const poolConfig = resolveWalletPool(network, address);
  const response = await fetch(`${BRILLIANT_API_BASE_URL}/staking-info?pool=${poolConfig.address}`);
  handleFetchErrors(response);
  return response.json() as Promise<ApiPoolState>;
}

export function resolveWalletPool(network: ApiNetwork, address: string) {
  return getPoolById(network, resolveWalletPoolId(address));
}

function getPoolById(network: ApiNetwork, id: StakingPoolId) {
  return POOLS_BY_NETWORK[network][id];
}

function resolveWalletPoolId(address: string) {
  return new Address(address).hashPart[0] % 2 ? '1' : '2';
}

function getPoolContract(network: ApiNetwork, address: string) {
  const poolConfig = resolveWalletPool(network, address);
  if (!poolConfig?.address) {
    return undefined;
  }

  return new NominatorPool(getTonWeb(network).provider, {
    address: poolConfig.address,
  });
}

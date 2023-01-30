import TonWeb from 'tonweb';
import BN from 'bn.js';

import memoized from '../../../util/memoized';
import { checkTransactionDraft, submitTransfer } from './transactions';
import { Storage } from '../../storages/types';
import { handleFetchErrors } from '../../common/utils';
import {
  BRILLIANT_API_BASE_URL,
  STAKING_POOLS_MAINNET,
  STAKING_POOLS_TESTNET,
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
  ApiStakingHistory,
} from '../../types';
import { STAKE_COMMENT, UNSTAKE_COMMENT } from './constants';

const { toNano } = TonWeb.utils;

const ONE_TON = '1000000000';
const UNSTAKE_AMOUNT = ONE_TON;
const MIN_STAKE_AMOUNT = 10001;
const MIN_POOL_BALANCE = 350000;
const CACHE_TTL = 60; // 1 m.
const DISABLE_CACHE_PERIOD = 30; // 30 s.

interface StakingPool {
  id: number;
  address: string;
  contract: NominatorPool;
}

const POOLS_BY_NETWORK: Record<ApiNetwork, Record<number, StakingPool>> = {
  mainnet: Object.fromEntries(STAKING_POOLS_MAINNET.map((address, index) => [index + 1, {
    id: index + 1,
    address,
    contract: new NominatorPool(getTonWeb('mainnet').provider, { address }),
  }])),
  testnet: Object.fromEntries(STAKING_POOLS_TESTNET.map((address, index) => [index + 1, {
    id: index + 1,
    address,
    contract: new NominatorPool(getTonWeb('testnet').provider, { address }),
  }])),
};

export const resolveWalletPool = memoized(async (network: ApiNetwork, address: string) => {
  const currentPool = await findCurrentPoolForAddress(network, address);
  if (currentPool) {
    return currentPool;
  }

  return pickPoolByBalance(network);
}, CACHE_TTL);

export async function checkStakeDraft(storage: Storage, accountId: string, amount: string) {
  const { network } = parseAccountId(accountId);
  const address = await fetchAddress(storage, accountId);
  const { address: poolAddress } = await resolveWalletPool(network, address);

  const result: {
    error?: ApiTransactionDraftError;
    fee?: string;
  } = {};

  const staked = await getStakingState(storage, accountId);
  if (!staked) {
    if (new BN(amount).lt(toNano(MIN_STAKE_AMOUNT.toString()))) {
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
  const { address: poolAddress } = await resolveWalletPool(network, address);
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
  const { address: poolAddress } = await resolveWalletPool(network, address);
  const result = await submitTransfer(
    storage,
    accountId,
    password,
    TON_TOKEN_SLUG,
    poolAddress,
    amount,
    STAKE_COMMENT,
  );
  onStakingChangeExpected();
  return result;
}

export async function submitUnstake(storage: Storage, accountId: string, password: string) {
  const { network } = parseAccountId(accountId);
  const address = await fetchAddress(storage, accountId);
  const { address: poolAddress } = await resolveWalletPool(network, address);
  const result = await submitTransfer(
    storage,
    accountId,
    password,
    TON_TOKEN_SLUG,
    poolAddress,
    UNSTAKE_AMOUNT,
    UNSTAKE_COMMENT,
  );
  onStakingChangeExpected();
  return result;
}

function onStakingChangeExpected() {
  resolveWalletPool.disableCache(DISABLE_CACHE_PERIOD);
}

export async function getStakingState(storage: Storage, accountId: string): Promise<ApiStakingState> {
  const { network } = parseAccountId(accountId);
  const address = await fetchAddress(storage, accountId);
  const contract = await getPoolContract(network, address);
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
  const poolConfig = await resolveWalletPool(network, address);
  const response = await fetch(`${BRILLIANT_API_BASE_URL}/staking-info?pool=${poolConfig.address}`);
  handleFetchErrors(response);
  return response.json() as Promise<ApiPoolState>;
}

async function findCurrentPoolForAddress(network: ApiNetwork, address: string) {
  const results = await Promise.all(
    getPools(network).map(async (pool) => {
      const nominators = await pool.contract.getListNominators();
      const isCurrent = nominators.find((n) => address === n.address);

      return isCurrent ? pool : undefined;
    }),
  );

  return results.find(Boolean);
}

async function pickPoolByBalance(network: ApiNetwork) {
  const items = await Promise.all(
    getPools(network).map(async (pool) => ({
      pool,
      amount: Number((await pool.contract.getPoolData()).stakeAmountSent),
    })),
  );

  return items.find(({ amount }) => amount > 0 && amount < MIN_POOL_BALANCE)?.pool
    || items.sort((item1, item2) => item1.amount - item2.amount)[0]!.pool;
}

function getPools(network: ApiNetwork) {
  return Object.values(POOLS_BY_NETWORK[network]);
}

async function getPoolContract(network: ApiNetwork, address: string) {
  const poolConfig = await resolveWalletPool(network, address);
  if (!poolConfig?.address) {
    return undefined;
  }

  return poolConfig.contract;
}

export async function getStakingHistory(storage: Storage, accountId: string) {
  const { network } = parseAccountId(accountId);
  if (network !== 'mainnet') {
    return {
      balance: 0,
      totalProfit: 0,
      profitHistory: [],
    };
  }
  const address = await fetchAddress(storage, accountId);
  const response = await fetch(`${BRILLIANT_API_BASE_URL}/staking-history?account=${address}`);
  handleFetchErrors(response);
  return response.json() as Promise<ApiStakingHistory>;
}

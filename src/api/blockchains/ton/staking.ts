import TonWeb from 'tonweb';
import BN from 'bn.js';

import memoized from '../../../util/memoized';
import { checkTransactionDraft, submitTransfer } from './transactions';
import { Storage } from '../../storages/types';
import { handleFetchErrors, isKnownStakingPool } from '../../common/utils';
import { BRILLIANT_API_BASE_URL, TON_TOKEN_SLUG } from '../../../config';
import { fetchAddress } from './address';
import { parseAccountId } from '../../../util/account';
import {
  ApiNetwork,
  ApiStakingState,
  ApiTransactionDraftError,
  ApiBackendStakingState,
} from '../../types';
import { STAKE_COMMENT, UNSTAKE_COMMENT } from './constants';
import { NominatorPool } from './contracts/NominatorPool';
import { getTonWeb } from './util/tonweb';

const { toNano } = TonWeb.utils;

const ONE_TON = '1000000000';
const UNSTAKE_AMOUNT = ONE_TON;
const MIN_STAKE_AMOUNT = 10001;
const CACHE_TTL = 60; // 1 m.
const DISABLE_CACHE_PERIOD = 30; // 30 s.

export const fetchStakingStateMemo = memoized(fetchBackendStakingState, CACHE_TTL);

export async function checkStakeDraft(storage: Storage, accountId: string, amount: string) {
  const address = await fetchAddress(storage, accountId);
  const { poolAddress } = await fetchStakingStateMemo(address);

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
  const address = await fetchAddress(storage, accountId);
  const { poolAddress } = await fetchStakingStateMemo(address);
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
  const address = await fetchAddress(storage, accountId);
  const { poolAddress } = await fetchStakingStateMemo(address);
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
  const address = await fetchAddress(storage, accountId);
  const { poolAddress } = await fetchStakingStateMemo(address);
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
  fetchStakingStateMemo.disableCache(DISABLE_CACHE_PERIOD);
}

export async function getStakingState(storage: Storage, accountId: string): Promise<ApiStakingState> {
  const { network } = parseAccountId(accountId);
  const address = await fetchAddress(storage, accountId);
  const contract = await getPoolContract(network, address);
  if (network !== 'mainnet' || !contract) {
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

async function getPoolContract(network: ApiNetwork, address: string) {
  const { poolAddress } = await fetchStakingStateMemo(address);
  return new NominatorPool(getTonWeb(network).provider, { address: poolAddress });
}

export async function getBackendStakingState(
  storage: Storage, accountId: string,
): Promise<ApiBackendStakingState | undefined> {
  const { network } = parseAccountId(accountId);
  if (network !== 'mainnet') {
    return undefined;
  }

  const address = await fetchAddress(storage, accountId);
  return fetchStakingStateMemo(address);
}

export async function fetchBackendStakingState(address: string) {
  const response = await fetch(`${BRILLIANT_API_BASE_URL}/staking-state?account=${address}`);
  handleFetchErrors(response);
  const stakingState = await response.json() as ApiBackendStakingState;

  if (!isKnownStakingPool(stakingState.poolAddress)) {
    throw Error('Unexpected pool address, likely a malicious activity');
  }

  return stakingState;
}

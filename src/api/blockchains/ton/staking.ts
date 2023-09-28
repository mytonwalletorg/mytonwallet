import TonWeb from 'tonweb';
import BN from 'bn.js';

import type {
  ApiBackendStakingState,
  ApiNetwork,
  ApiStakingState,
} from '../../types';
import {
  ApiTransactionDraftError,
} from '../../types';

import { TON_TOKEN_SLUG } from '../../../config';
import { parseAccountId } from '../../../util/account';
import memoized from '../../../util/memoized';
import { getTonWeb, toBase64Address } from './util/tonweb';
import { NominatorPool } from './contracts/NominatorPool';
import { fetchStoredAddress } from '../../common/accounts';
import { callBackendGet } from '../../common/backend';
import { isKnownStakingPool } from '../../common/utils';
import { STAKE_COMMENT, UNSTAKE_COMMENT } from './constants';
import { checkTransactionDraft, submitTransfer } from './transactions';

const { toNano } = TonWeb.utils;

const ONE_TON = '1000000000';
const UNSTAKE_AMOUNT = ONE_TON;
const MIN_STAKE_AMOUNT = 10001;
const CACHE_TTL = 60; // 1 m.
const DISABLE_CACHE_PERIOD = 30; // 30 s.

export const fetchStakingStateMemo = memoized(fetchBackendStakingState, CACHE_TTL);

export async function checkStakeDraft(accountId: string, amount: string) {
  const address = await fetchStoredAddress(accountId);
  const { poolAddress } = await fetchStakingStateMemo(address);

  const result: {
    error?: ApiTransactionDraftError;
    fee?: string;
  } = {};

  const staked = await getStakingState(accountId);
  if (!staked) {
    if (new BN(amount).lt(toNano(MIN_STAKE_AMOUNT.toString()))) {
      result.error = ApiTransactionDraftError.InvalidAmount;
      return result;
    }
  }

  return checkTransactionDraft(
    accountId,
    TON_TOKEN_SLUG,
    poolAddress,
    amount,
    STAKE_COMMENT,
  );
}

export async function checkUnstakeDraft(accountId: string) {
  const address = await fetchStoredAddress(accountId);
  const { poolAddress } = await fetchStakingStateMemo(address);
  return checkTransactionDraft(
    accountId,
    TON_TOKEN_SLUG,
    poolAddress,
    UNSTAKE_AMOUNT,
    UNSTAKE_COMMENT,
  );
}

export async function submitStake(accountId: string, password: string, amount: string) {
  const address = await fetchStoredAddress(accountId);
  const { poolAddress } = await fetchStakingStateMemo(address);
  const result = await submitTransfer(
    accountId,
    password,
    TON_TOKEN_SLUG,
    toBase64Address(poolAddress),
    amount,
    STAKE_COMMENT,
  );
  onStakingChangeExpected();
  return result;
}

export async function submitUnstake(accountId: string, password: string) {
  const address = await fetchStoredAddress(accountId);
  const { poolAddress } = await fetchStakingStateMemo(address);
  const result = await submitTransfer(
    accountId,
    password,
    TON_TOKEN_SLUG,
    toBase64Address(poolAddress),
    UNSTAKE_AMOUNT,
    UNSTAKE_COMMENT,
  );
  onStakingChangeExpected();
  return result;
}

function onStakingChangeExpected() {
  fetchStakingStateMemo.disableCache(DISABLE_CACHE_PERIOD);
}

export async function getStakingState(accountId: string): Promise<ApiStakingState> {
  const { network } = parseAccountId(accountId);
  const address = await fetchStoredAddress(accountId);
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

export async function getBackendStakingState(accountId: string): Promise<ApiBackendStakingState | undefined> {
  const { network } = parseAccountId(accountId);
  if (network !== 'mainnet') {
    return undefined;
  }

  const address = await fetchStoredAddress(accountId);
  return fetchStakingStateMemo(address);
}

export async function fetchBackendStakingState(address: string) {
  const stakingState = await callBackendGet(`/staking-state?account=${address}`) as ApiBackendStakingState;

  if (!isKnownStakingPool(stakingState.poolAddress)) {
    throw Error('Unexpected pool address, likely a malicious activity');
  }

  return stakingState;
}

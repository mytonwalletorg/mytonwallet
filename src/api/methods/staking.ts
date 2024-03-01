import type {
  ApiBackendStakingState,
  ApiStakingCommonData,
  ApiStakingHistory,
  ApiStakingType,
} from '../types';

import { APP_ENV, APP_VERSION, TON_TOKEN_SLUG } from '../../config';
import { fromDecimal } from '../../util/decimals';
import { logDebugError } from '../../util/logs';
import blockchains from '../blockchains';
import { STAKE_COMMENT, UNSTAKE_COMMENT } from '../blockchains/ton/constants';
import { fetchStoredAccount, fetchStoredAddress } from '../common/accounts';
import { callBackendGet } from '../common/backend';
import { setStakingCommonCache } from '../common/cache';
import { resolveBlockchainKey } from '../common/helpers';
import { isKnownStakingPool } from '../common/utils';
import { getEnvironment } from '../environment';
import { getClientId } from './other';
import { createLocalTransaction } from './transactions';

const CACHE_TTL = 5000; // 5 s.
let backendStakingStateByAddress: Record<string, [number, ApiBackendStakingState]> = {};

// let onUpdate: OnApiUpdate;

export function initStaking() {
  // onUpdate = _onUpdate;
}

export async function checkStakeDraft(accountId: string, amount: bigint) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  const backendState = await getBackendStakingState(accountId);
  return blockchain.checkStakeDraft(accountId, amount, backendState!);
}

export async function checkUnstakeDraft(accountId: string, amount: bigint) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  const backendState = await getBackendStakingState(accountId);
  return blockchain.checkUnstakeDraft(accountId, amount, backendState!);
}

export async function submitStake(
  accountId: string, password: string, amount: bigint, type: ApiStakingType, fee?: bigint,
) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];
  const fromAddress = await fetchStoredAddress(accountId);

  const backendState = await getBackendStakingState(accountId);
  const result = await blockchain.submitStake(
    accountId, password, amount, type, backendState!,
  );
  if ('error' in result) {
    return false;
  }

  onStakingChangeExpected();

  const localTransaction = createLocalTransaction(accountId, {
    amount: result.amount,
    fromAddress,
    toAddress: result.toAddress,
    comment: STAKE_COMMENT,
    fee: fee || 0n,
    type: 'stake',
    slug: TON_TOKEN_SLUG,
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
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];
  const fromAddress = await fetchStoredAddress(accountId);

  const backendState = await getBackendStakingState(accountId);
  const result = await blockchain.submitUnstake(accountId, password, type, amount, backendState!);
  if ('error' in result) {
    return false;
  }

  onStakingChangeExpected();

  const localTransaction = createLocalTransaction(accountId, {
    amount: result.amount,
    fromAddress,
    toAddress: result.toAddress,
    comment: UNSTAKE_COMMENT,
    fee: fee || 0n,
    type: 'unstakeRequest',
    slug: TON_TOKEN_SLUG,
  });

  return {
    ...result,
    txId: localTransaction.txId,
  };
}

export async function getBackendStakingState(accountId: string): Promise<ApiBackendStakingState> {
  const { address, ledger } = await fetchStoredAccount(accountId);
  const state = await fetchBackendStakingState(address, Boolean(ledger));
  return {
    ...state,
    nominatorsPool: {
      ...state.nominatorsPool,
      start: state.nominatorsPool.start * 1000,
      end: state.nominatorsPool.end * 1000,
    },
  };
}

export async function fetchBackendStakingState(address: string, isLedger: boolean): Promise<ApiBackendStakingState> {
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

  const stakingState = await callBackendGet(`/staking/state/${address}`, {
    isLedger,
  }, headers);
  stakingState.balance = fromDecimal(stakingState.balance);
  stakingState.totalProfit = fromDecimal(stakingState.totalProfit);

  if (!isKnownStakingPool(stakingState.nominatorsPool.address)) {
    throw Error('Unexpected pool address, likely a malicious activity');
  }

  backendStakingStateByAddress[address] = [Date.now() + CACHE_TTL, stakingState];

  return stakingState;
}

export async function getStakingHistory(
  accountId: string, limit?: number, offset?: number,
): Promise<ApiStakingHistory> {
  const address = await fetchStoredAddress(accountId);
  return callBackendGet(`/staking/profits/${address}`, { limit, offset });
}

export function onStakingChangeExpected() {
  backendStakingStateByAddress = {};
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

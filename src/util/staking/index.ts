import type { ApiStakingState, ApiStakingType } from '../../api/types';

import {
  MIN_ACTIVE_STAKING_REWARDS,
  NEW_STAKE_DISABLED_TOKEN_SLUGS,
  STAKING_MIN_AMOUNT,
} from '../../config';

export function getIsNewStakeAllowed(tokenSlug?: string) {
  return !tokenSlug || !NEW_STAKE_DISABLED_TOKEN_SLUGS.has(tokenSlug);
}

export function getStakingMinAmount(_type?: ApiStakingType) {
  return STAKING_MIN_AMOUNT;
}

export function getUnstakeTime(state?: ApiStakingState) {
  switch (state?.type) {
    case 'liquid':
      return state.end;
    default:
      return undefined;
  }
}

export function getStakingTitle(_stakingType?: ApiStakingState['type']) {
  return 'Why this is safe';
}

export type StakingStateStatus = 'inactive' | 'active' | 'unstakeRequested' | 'readyToClaim';

export function getStakingStateStatus(state: ApiStakingState): StakingStateStatus {
  if (state.unstakeRequestAmount) {
    return 'unstakeRequested';
  }
  if (getIsActiveStakingState(state)) {
    return 'active';
  }
  return 'inactive';
}

export function getIsActiveStakingState(state: ApiStakingState) {
  return Boolean(
    state.balance
    || state.unstakeRequestAmount
    || ('unclaimedRewards' in state && state.unclaimedRewards > MIN_ACTIVE_STAKING_REWARDS),
  );
}

export function getIsStakingClaimable(state: ApiStakingState) {
  if (state.type === 'jetton') {
    return state.unclaimedRewards > 0n;
  }

  return getStakingStateStatus(state) === 'readyToClaim';
}

export function getIsStakingUnstakeable(state: ApiStakingState) {
  return state.balance > 0n;
}

export function getIsLongUnstake(state: ApiStakingState, amount?: bigint): boolean | undefined {
  switch (state.type) {
    case 'liquid': {
      return amount === undefined ? false : amount > state.instantAvailable;
    }
    case 'jetton': {
      return false;
    }
  }

  return undefined;
}

export function getFullStakingBalance(state: ApiStakingState): bigint {
  switch (state.type) {
    case 'jetton': {
      return state.balance + state.unclaimedRewards;
    }
    case 'liquid': {
      return state.balance;
    }
  }
}

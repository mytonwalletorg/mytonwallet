import type { ApiStakingState, ApiToken } from '../../api/types';
import type { DropdownItem } from '../../components/ui/Dropdown';

import { MIN_ACTIVE_STAKING_REWARDS } from '../../config';
import { ASSET_LOGO_PATHS } from '../../components/ui/helpers/assetLogos';

export function buildStakingDropdownItems({
  tokenBySlug, states, shouldUseNominators,
}: {
  tokenBySlug: Record<string, ApiToken>;
  states: ApiStakingState[];
  shouldUseNominators?: boolean;
}) {
  const hasNominatorsStake = states.some((state) => state.type === 'nominators' && getIsActiveStakingState(state));
  const hasLiquidStake = states.some((state) => state.type === 'liquid' && getIsActiveStakingState(state));

  if (shouldUseNominators && !hasLiquidStake) {
    states = states.filter((state) => state.type !== 'liquid');
  }

  if (!shouldUseNominators && !hasNominatorsStake) {
    states = states.filter((state) => state.type !== 'nominators');
  }

  const res = states.filter((state) => tokenBySlug[state.tokenSlug]).map<DropdownItem>((state) => {
    const stateToken = tokenBySlug[state.tokenSlug];
    const logoPath = ASSET_LOGO_PATHS[stateToken.symbol.toLowerCase() as keyof typeof ASSET_LOGO_PATHS];

    return {
      value: state.id,
      icon: logoPath ?? stateToken.image,
      name: stateToken.symbol,
    };
  });
  return res;
}

export type StakingStateStatus = 'inactive' | 'active' | 'unstakeRequested' | 'readyToClaim';

export function getStakingStateStatus(state: ApiStakingState): StakingStateStatus {
  if (state.unstakeRequestAmount) {
    if (state.type === 'ethena' && state.unlockTime && state.unlockTime <= Date.now()) {
      return 'readyToClaim';
    }

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

export function getIsLongUnstake(state: ApiStakingState, amount?: bigint): boolean | undefined {
  switch (state.type) {
    case 'nominators': {
      return true;
    }
    case 'liquid': {
      return amount === undefined ? false : amount > state.instantAvailable;
    }
    case 'jetton': {
      return false;
    }
    case 'ethena': {
      return true;
    }
  }

  return undefined;
}

export function getFullStakingBalance(state: ApiStakingState): bigint {
  switch (state.type) {
    case 'jetton': {
      return state.balance + state.unclaimedRewards;
    }
    case 'ethena': {
      return state.balance + state.unstakeRequestAmount;
    }
  }

  return state.balance;
}

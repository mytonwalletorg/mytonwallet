import type { ApiStakingState, ApiToken } from '../../api/types';
import type { DropdownItem } from '../../components/ui/Dropdown';

import { ASSET_LOGO_PATHS } from '../../components/ui/helpers/assetLogos';

export function buildStakingDropdownItems({
  tokenBySlug, states, shouldUseNominators,
}: {
  tokenBySlug: Record<string, ApiToken>;
  states: ApiStakingState[];
  shouldUseNominators?: boolean;
}) {
  if (!shouldUseNominators) {
    shouldUseNominators = states.some((state) => state.type === 'nominators' && state.balance);
  }

  if (shouldUseNominators) {
    states = states.filter((state) => state.type !== 'liquid');
  } else {
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

export type StakingStateStatus = 'inactive' | 'active' | 'unstakeRequested';

export function getStakingStateStatus(state: ApiStakingState): StakingStateStatus {
  if (state.isUnstakeRequested) {
    return 'unstakeRequested';
  }
  if (!state.balance) {
    return 'inactive';
  }
  return 'active';
}

export function getIsActiveStakingState(state: ApiStakingState) {
  return Boolean(state.balance || state.isUnstakeRequested);
}

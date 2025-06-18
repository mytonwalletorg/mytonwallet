import type { ApiStakingState, ApiToken } from '../../../api/types';
import type { DropdownItem } from '../../ui/Dropdown';

import { getIsActiveStakingState } from '../../../util/staking';
import { ASSET_LOGO_PATHS } from '../../ui/helpers/assetLogos';

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

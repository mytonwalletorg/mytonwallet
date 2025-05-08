import type { ApiStakingState, ApiStakingType } from '../../api/types';
import type { GlobalState } from '../../global/types';

import {
  ETHENA_STAKING_MIN_AMOUNT,
  NOMINATORS_STAKING_MIN_AMOUNT,
  STAKING_MIN_AMOUNT,
} from '../../config';

export function getStakingMinAmount(type?: ApiStakingType) {
  switch (type) {
    case 'nominators':
      return NOMINATORS_STAKING_MIN_AMOUNT;
    case 'ethena':
      return ETHENA_STAKING_MIN_AMOUNT;
    default:
      return STAKING_MIN_AMOUNT;
  }
}

export function getUnstakeTime(state?: ApiStakingState, info?: GlobalState['stakingInfo']) {
  switch (state?.type) {
    case 'nominators': {
      return state.end;
    }
    case 'liquid': {
      return info?.round.end;
    }
    case 'ethena': {
      return state.unlockTime;
    }
  }

  return undefined;
}

export function getStakingTitle(stakingType?: ApiStakingState['type']) {
  return stakingType === 'ethena' ? 'How does it work?' : 'Why this is safe';
}

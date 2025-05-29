import type { ApiStakingState, ApiStakingType } from '../../api/types';
import type { GlobalState } from '../../global/types';

import {
  ETHENA_STAKING_MIN_AMOUNT,
  NOMINATORS_STAKING_MIN_AMOUNT,
  STAKING_MIN_AMOUNT,
  UNSTAKE_TON_GRACE_PERIOD,
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
      if (!info) {
        return undefined;
      }

      const { prevRound, round: currentRound } = info;
      const now = Date.now();
      const gracePeriod = UNSTAKE_TON_GRACE_PERIOD;

      // Show date of next unlock plus few minutes
      // (except when grace period is active and payout has already occurred — i.e. collection has disappeared).
      if (now > prevRound.unlock && now < prevRound.unlock + gracePeriod && !info.liquid.collection) {
        return currentRound.unlock + gracePeriod;
      }

      return (now < prevRound.unlock + gracePeriod ? prevRound.unlock : currentRound.unlock) + gracePeriod;
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

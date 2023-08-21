import { StakingState } from '../types';
import type { ApiPoolState } from '../../api/types';
import type { GlobalState } from '../types';

import isPartialDeepEqual from '../../util/isPartialDeepEqual';
import { selectCurrentAccountState } from '../selectors';
import { updateCurrentAccountState } from './misc';

export function updateStaking(global: GlobalState, update: Partial<GlobalState['staking']>): GlobalState {
  return {
    ...global,
    staking: {
      ...global.staking,
      ...update,
    },
  };
}

export function clearStaking(global: GlobalState) {
  return {
    ...global,
    staking: {
      state: StakingState.None,
    },
  };
}

export function updatePoolState(global: GlobalState, partial: ApiPoolState, withDeepCompare = false): GlobalState {
  const currentPoolState = selectCurrentAccountState(global)?.poolState;

  if (
    !global.currentAccountId
    || (withDeepCompare && currentPoolState && isPartialDeepEqual(currentPoolState, partial))
  ) {
    return global;
  }

  return updateCurrentAccountState(global, {
    poolState: {
      ...currentPoolState,
      ...partial,
    },
  });
}

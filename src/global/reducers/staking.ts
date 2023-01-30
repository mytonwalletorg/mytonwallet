import { GlobalState, StakingState } from '../types';
import { ApiPoolState } from '../../api/types';
import { updateCurrentAccountsState } from './misc';
import { selectCurrentAccountState } from '../selectors';
import isPartialDeepEqual from '../../util/isPartialDeepEqual';

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

  if (withDeepCompare && currentPoolState && isPartialDeepEqual(currentPoolState, partial)) {
    return global;
  }

  return updateCurrentAccountsState(global, {
    poolState: {
      ...currentPoolState,
      ...partial,
    },
  });
}

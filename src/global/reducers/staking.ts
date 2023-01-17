import { GlobalState, StakingState } from '../types';
import { ApiPoolState } from '../../api/types';
import { updateCurrentAccountsState } from './misc';
import { selectCurrentAccountState } from '../selectors';

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

export function updatePoolState(global: GlobalState, update: ApiPoolState): GlobalState {
  const currentPoolState = selectCurrentAccountState(global)?.poolState;

  return updateCurrentAccountsState(global, {
    poolState: {
      ...currentPoolState,
      ...update,
    },
  });
}

import type { AccountState, GlobalState } from '../types';
import { StakingState } from '../types';

import isPartialDeepEqual from '../../util/isPartialDeepEqual';
import { selectAccountState } from '../selectors';
import { updateAccountState } from './misc';

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

export function updateAccountStakingState(
  global: GlobalState,
  accountId: string,
  state: NonNullable<AccountState['staking']>,
  withDeepCompare = false,
): GlobalState {
  const currentState = selectAccountState(global, accountId)?.staking;

  if (withDeepCompare && currentState && isPartialDeepEqual(currentState, state)) {
    return global;
  }

  return updateAccountState(global, accountId, {
    staking: {
      ...currentState,
      ...state,
    },
  });
}

export function updateAccountStakingStatePartial(
  global: GlobalState,
  accountId: string,
  partial: Partial<AccountState['staking']>,
): GlobalState {
  const currentState = selectAccountState(global, accountId)?.staking;

  if (!currentState) {
    return global;
  }

  return updateAccountState(global, accountId, {
    staking: {
      ...currentState,
      ...partial,
    },
  });
}

export function updateStakingInfo(global: GlobalState, stakingInfo: GlobalState['stakingInfo']) {
  return {
    ...global,
    stakingInfo,
  };
}

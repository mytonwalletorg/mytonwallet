import type { ApiStakingState } from '../../api/types';
import type { GlobalState } from '../types';

import { TONCOIN } from '../../config';
import memoize from '../../util/memoize';
import withCache from '../../util/withCache';
import { selectAccountState } from './accounts';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const selectAccountStakingStatesMemoizedFor = withCache((accountId: string) => memoize((
  stateDefault: ApiStakingState,
  stateById?: Record<string, ApiStakingState>,
) => {
  const states = stateById ? Object.values(stateById) : undefined;
  return states?.length ? states : [stateDefault];
}));

export function selectAccountStakingStates(global: GlobalState, accountId: string) {
  const { stateById } = selectAccountState(global, accountId)?.staking ?? {};
  return selectAccountStakingStatesMemoizedFor(accountId)(global.stakingDefault, stateById);
}

export function selectAccountStakingState(global: GlobalState, accountId: string): ApiStakingState {
  const { stateById, stakingId } = selectAccountState(global, accountId)?.staking ?? {};
  if (!stateById || !stakingId || !(stakingId in stateById)) {
    return global.stakingDefault;
  }

  return stateById[stakingId];
}

export function selectAccountStakingHistory(global: GlobalState, accountId: string) {
  const accountState = selectAccountState(global, accountId);
  const stakingState = selectAccountStakingState(global, accountId);
  return stakingState.tokenSlug === TONCOIN.slug ? accountState?.stakingHistory : undefined;
}

export function selectAccountStakingTotalProfit(global: GlobalState, accountId: string) {
  const accountState = selectAccountState(global, accountId);
  const stakingState = selectAccountStakingState(global, accountId);
  return (stakingState.tokenSlug === TONCOIN.slug ? accountState?.staking?.totalProfit : undefined) ?? 0n;
}

import type { ApiStakingState } from '../../api/types';
import type { Account, GlobalState } from '../types';

import { buildCollectionByKey } from '../../util/iteratees';
import memoize from '../../util/memoize';
import withCache from '../../util/withCache';
import { selectAccountState } from './accounts';

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

const selectAccountStakingStatesBySlugMemoizedFor = withCache((accountId: string) => memoize(
  (stakingStates: ApiStakingState[]) => buildCollectionByKey(stakingStates, 'tokenSlug'),
));

export function selectAccountStakingStatesBySlug(global: GlobalState, accountId: string) {
  return selectAccountStakingStatesBySlugMemoizedFor(accountId)(selectAccountStakingStates(global, accountId));
}

export function selectAccountStakingState(global: GlobalState, accountId: string): ApiStakingState {
  const { stateById, stakingId } = selectAccountState(global, accountId)?.staking ?? {};

  if (!stateById || !stakingId || !(stakingId in stateById)) {
    return global.stakingDefault;
  }

  return stateById[stakingId];
}

export function selectIsStakingDisabled(global: GlobalState) {
  return Boolean(global.settings.isTestnet);
}

export function selectMultipleAccountsStakingStatesSlow(
  networkAccounts: Record<string, Account> | undefined,
  byAccountId: GlobalState['byAccountId'],
  stakingDefault: ApiStakingState,
) {
  const result: Record<string, ApiStakingState[] | undefined> = {};
  if (networkAccounts === undefined) return result;

  for (const accountId in networkAccounts) {
    const { stateById } = byAccountId[accountId]?.staking ?? {};
    result[accountId] = selectAccountStakingStatesMemoizedFor(accountId)(stakingDefault, stateById);
  }

  return result;
}

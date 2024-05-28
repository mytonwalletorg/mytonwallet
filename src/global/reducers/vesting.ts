import type { ApiVestingInfo } from '../../api/types';
import type { AccountState, GlobalState } from '../types';

import { selectAccountState } from '../selectors';
import { updateAccountState } from './misc';

export function updateVestingInfo(global: GlobalState, accountId: string, update: ApiVestingInfo[]): GlobalState {
  return updateVesting(global, accountId, {
    info: update,
  });
}

export function updateVesting(
  global: GlobalState,
  accountId: string,
  update: Partial<AccountState['vesting']>,
): GlobalState {
  return updateAccountState(global, accountId, {
    vesting: {
      ...selectAccountState(global, accountId)?.vesting || { info: [] },
      ...update,
    },
  });
}

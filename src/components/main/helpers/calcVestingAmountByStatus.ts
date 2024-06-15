import type { ApiVestingInfo, ApiVestingPartStatus } from '../../../api/types';

export function calcVestingAmountByStatus(vesting: ApiVestingInfo[], statuses: ApiVestingPartStatus[]) {
  return vesting.reduce((acc, currentVesting) => {
    return acc + currentVesting.parts.reduce((currentAcc, part) => {
      return currentAcc + (statuses.includes(part.status) ? part.amount : 0);
    }, 0);
  }, 0).toString();
}

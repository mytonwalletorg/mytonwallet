import type { ApiVestingInfo } from '../api/types';

const DAY = 1000 * 60 * 60 * 24;
const DEFAULT_DEADLINE = 30 * DAY;

export default function calcUnfreezeEndDates(vesting: ApiVestingInfo[]) {
  return vesting.map((vestingItem) => {
    const readyPartIndex = vestingItem.parts.findIndex((p) => p.status === 'ready');
    if (readyPartIndex === -1) return undefined;

    const nextPart = vestingItem.parts[readyPartIndex + 1];
    if (nextPart) {
      return new Date(nextPart?.time).getTime();
    }

    const readyPart = vestingItem.parts[readyPartIndex]!;
    return new Date(readyPart.time).getTime() + DEFAULT_DEADLINE;
  });
}

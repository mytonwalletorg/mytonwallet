import type { ApiActivity } from '../api/types';

import { getIsActivityPending } from './activities';

export function compareActivities(a: ApiActivity, b: ApiActivity, isAsc = false) {
  // Putting the pending activities first, because when they get confirmed, their timestamp gets bigger than any current
  // confirmed activity timestamp. This reduces the movement in the activity list.
  let value = (getIsActivityPending(a) ? 1 : 0) - (getIsActivityPending(b) ? 1 : 0);
  if (value === 0) {
    value = a.timestamp - b.timestamp;
    if (value === 0) {
      value = a.id > b.id ? 1 : a.id < b.id ? -1 : 0;
    }
  }
  return isAsc ? value : -value;
}

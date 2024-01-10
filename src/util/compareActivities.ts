import type { ApiActivity } from '../api/types';

export function compareActivities(a: ApiActivity, b: ApiActivity, isAsc = false) {
  let value = a.timestamp - b.timestamp;
  if (value === 0) {
    value = a.id > b.id ? 1 : a.id < b.id ? -1 : 0;
  }
  return isAsc ? value : -value;
}

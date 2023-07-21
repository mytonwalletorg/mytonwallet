import type { ApiTransaction } from '../api/types';

export function compareTransactions(a: ApiTransaction, b: ApiTransaction, isAsc: boolean) {
  let value = a.timestamp - b.timestamp;
  if (value === 0) {
    value = a.txId > b.txId ? 1 : a.txId < b.txId ? -1 : 0;
  }
  return isAsc ? value : -value;
}

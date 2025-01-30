import type { BigSource } from '../lib/big.js';

import { Big } from '../lib/big.js';

export function bigMin<T1 extends BigSource, T2 extends BigSource>(value0: T1, value1: T2): T1 | T2 {
  return Big(value0).lt(value1) ? value0 : value1;
}

export function bigMax<T1 extends BigSource, T2 extends BigSource>(value0: T1, value1: T2): T1 | T2 {
  return Big(value0).gt(value1) ? value0 : value1;
}

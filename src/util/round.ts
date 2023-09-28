import type { RoundingMode } from '../lib/big.js';

import { Big } from '../lib/big.js';

export function round(value: number | string, precision = 0, roundingMode: RoundingMode = Big.roundHalfUp) {
  const bn = new Big(value);

  return bn.round(precision, roundingMode).toNumber();
}

export function floor(value: number | string, precision = 0) {
  return round(value, precision, Big.roundDown);
}

export function ceil(value: number | string, precision = 0) {
  return round(value, precision, Big.roundUp);
}

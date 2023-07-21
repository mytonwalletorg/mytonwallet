import { Big } from '../lib/big.js';

export function round(value: number, precision = 0) {
  const bn = new Big(value);

  return bn.round(precision, Big.roundHalfUp).toNumber();
}

export function floor(value: number, precision = 0) {
  const bn = new Big(value);

  return bn.round(precision, Big.roundDown).toNumber();
}

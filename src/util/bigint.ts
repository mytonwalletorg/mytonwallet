import { ONE_TON } from '../config';
import { fromDecimal } from './decimals';

const PREFIX = 'bigint:';

// @ts-ignore
BigInt.prototype.toJSON = function toJSON() {
  return `${PREFIX}${this}`;
};

export function bigintReviver(this: any, key: string, value: any) {
  if (typeof value === 'string' && value.startsWith(PREFIX)) {
    return BigInt(value.slice(7));
  }
  return value;
}

export function bigintAbs(value: bigint) {
  return value === -0n || value < 0n ? -value : value;
}

export function bigintDivideToNumber(value: bigint, num: number) {
  return (value * ONE_TON) / fromDecimal(num);
}

export function bigintMultiplyToNumber(value: bigint, num: number) {
  return (value * fromDecimal(num)) / ONE_TON;
}

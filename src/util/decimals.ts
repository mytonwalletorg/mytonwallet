import { TONCOIN } from '../config';
import { Big } from '../lib/big.js';

Big.RM = 0; // RoundDown
Big.NE = -100000; // Disable exponential form
Big.PE = 100000; // Disable exponential form

const ten = Big(10);

export function fromDecimal(value: string | number, decimals?: number) {
  return BigInt(Big(value).mul(ten.pow(decimals ?? TONCOIN.decimals)).round().toString());
}

export function toDecimal(value: bigint | number, decimals?: number, noFloor = false) {
  return toBig(value, decimals ?? TONCOIN.decimals, noFloor).toString();
}

export function toBig(value: bigint | number, decimals: number = TONCOIN.decimals, noFloor = false) {
  return Big(value.toString()).div(ten.pow(decimals)).round(decimals, noFloor ? Big.roundHalfUp : undefined);
}

export function roundDecimal(value: string, decimals: number) {
  return Big(value).round(decimals).toString();
}

import { DEFAULT_DECIMAL_PLACES } from '../../config';

export function bigStrToHuman(amount: string, decimalPlaces?: number) {
  if (decimalPlaces === undefined) decimalPlaces = DEFAULT_DECIMAL_PLACES;
  return divideBigInt(BigInt(amount), BigInt(10 ** decimalPlaces));
}

export function humanToBigStr(amount: number, decimalPlaces?: number) {
  if (decimalPlaces === undefined) decimalPlaces = DEFAULT_DECIMAL_PLACES;
  return String(Math.round(amount * (10 ** decimalPlaces)));
}

function divideBigInt(a: bigint, b: bigint) {
  const div = a / b;
  return Number(div) + Number(a - div * b) / Number(b);
}

export function getIsTxIdLocal(txId: string) {
  return txId.includes('|');
}

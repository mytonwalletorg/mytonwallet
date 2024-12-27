import { TONCOIN } from '../../config';

const regexCache: Record<number, RegExp> = {};

export function getNumberParts(value: string, decimals: number = TONCOIN.decimals) {
  const regex = getNumberRegex(decimals);
  return value.match(regex) || undefined;
}

export function getNumberRegex(decimals: number): RegExp {
  if (regexCache[decimals]) {
    return regexCache[decimals];
  }

  const regex = decimals === 0
    ? /^(\d+)/
    : new RegExp(`^(\\d+)([.,])?(\\d{1,${decimals}})?`);

  regexCache[decimals] = regex;

  return regex;
}

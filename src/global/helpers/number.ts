import { TONCOIN } from '../../config';
import withCache from '../../util/withCache';

export const getNumberRegex = withCache((decimals: number): RegExp => {
  return decimals === 0
    ? /^(\d+)/
    : new RegExp(`^(\\d+)([.,])?(\\d{1,${decimals}})?`);
});

export function getNumberParts(value: string, decimals: number = TONCOIN.decimals) {
  const regex = getNumberRegex(decimals);
  return value.match(regex) || undefined;
}

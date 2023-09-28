import { DEFAULT_DECIMAL_PLACES, DEFAULT_PRICE_CURRENCY } from '../config';
import withCache from './withCache';

export const formatInteger = withCache((value: number, fractionDigits = 2, noRadix = false) => {
  const dp = value > 1 ? fractionDigits : DEFAULT_DECIMAL_PLACES;
  const fixed = value.toFixed(dp);

  let [wholePart, fractionPart = ''] = fixed.split('.');

  fractionPart = toSignificant(fractionPart, Math.min(fractionDigits, 100)).replace(/0+$/, '');
  if (fractionPart === '') {
    wholePart = wholePart.replace(/^-0$/, '0');
  }
  if (!noRadix) {
    wholePart = wholePart.replace(/\d(?=(\d{3})+($|\.))/g, '$&,');
  }

  return [
    wholePart,
    fractionPart,
  ].filter(Boolean).join('.');
});

export function formatCurrency(value: number, currency: string, fractionDigits?: number) {
  const formatted = formatInteger(value, fractionDigits);
  return currency === '$' ? `$${formatted}`.replace('$-', '-$') : `${formatted} ${currency}`;
}

export function formatCurrencyExtended(value: number, currency: string, noSign = false, fractionDigits?: number) {
  const prefix = !noSign ? (value > 0 ? '+\u202F' : '\u2212\u202F') : '';

  return prefix + formatCurrency(noSign ? value : Math.abs(value), currency, fractionDigits);
}

export function formatCurrencyForBigValue(value: number, threshold = 1000) {
  const formattedValue = formatCurrency(value, DEFAULT_PRICE_CURRENCY);

  if (value < threshold) {
    return formattedValue;
  }

  const [mainPart] = formattedValue.split('.');

  return mainPart;
}

/**
 * @example
 * '000012', 2 => '000012'
 * '120012', 2 => '12'
 * '010012', 2 => '01'
 * '001012', 2 => '001'
 * '000112', 2 => '00011'
 * '100012', 2 => '1'
 * @param value fractionPart of number
 */
function toSignificant(value: string, fractionDigits: number): string {
  let digitsCount = 0;
  let digitsLastIndex = 0;

  for (let i = 0; i < value.length; i++) {
    digitsLastIndex += 1;

    if (value[i] === '0' && digitsCount === 0) {
      continue;
    }

    digitsCount += 1;

    if (digitsCount === fractionDigits) {
      break;
    }
  }

  return value.slice(0, digitsLastIndex).replace(/0+$/, '');
}

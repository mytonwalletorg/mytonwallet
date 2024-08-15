import type { ApiBaseCurrency } from '../api/types';

import {
  DEFAULT_DECIMAL_PLACES,
  DEFAULT_PRICE_CURRENCY,
  SHORT_CURRENCY_SYMBOL_MAP,
  WHOLE_PART_DELIMITER,
} from '../config';
import { Big } from '../lib/big.js';
import { toDecimal } from './decimals';
import withCache from './withCache';

const SHORT_SYMBOLS = new Set(Object.values(SHORT_CURRENCY_SYMBOL_MAP));

export const formatInteger = withCache((
  value: number | Big | string,
  fractionDigits = 2,
  noRadix = false,
  noFloor?: boolean,
) => {
  value = Big(value);
  const dp = value.gte(1) || noFloor ? fractionDigits : DEFAULT_DECIMAL_PLACES;
  let fixed = value.round(dp, noFloor ? Big.roundHalfUp : undefined).toString();

  if (value.lt(1) && countSignificantDigits(fixed) < fractionDigits) {
    fixed = value.toString();
  }

  let [wholePart, fractionPart = ''] = fixed.split('.');

  fractionPart = toSignificant(fractionPart, Math.min(fractionDigits, 100)).replace(/0+$/, '');
  if (fractionPart === '') {
    wholePart = wholePart.replace(/^-0$/, '0');
  }
  if (!noRadix) {
    wholePart = wholePart.replace(/\d(?=(\d{3})+($|\.))/g, `$&${WHOLE_PART_DELIMITER}`);
  }

  return [
    wholePart,
    fractionPart,
  ].filter(Boolean).join('.');
});

export function formatCurrency(
  value: number | string | Big,
  currency: string,
  fractionDigits?: number,
  noFloor?: boolean,
) {
  const formatted = formatInteger(value, fractionDigits, undefined, noFloor);
  return addCurrency(formatted, currency);
}

export function formatCurrencyExtended(
  value: number | string, currency: string, noSign = false, fractionDigits?: number,
) {
  value = value.toString();

  const prefix = !noSign ? (!value.startsWith('-') ? '+\u202F' : '\u2212\u202F') : '';

  return prefix + formatCurrency(noSign ? value : value.replace('-', ''), currency, fractionDigits);
}

export function formatCurrencySimple(value: number | bigint | string, currency: string, decimals?: number) {
  if (typeof value !== 'string') {
    value = toDecimal(value, decimals);
  }
  return addCurrency(value, currency);
}

function addCurrency(value: number | string, currency: string) {
  return SHORT_SYMBOLS.has(currency)
    ? `${currency}${value}`.replace(`${currency}-`, `-${currency}`)
    : `${value} ${currency}`;
}

export function formatCurrencyForBigValue(value: number, currency: string, threshold = 1000) {
  const formattedValue = formatCurrency(value, currency);

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
 * @param fractionDigits number of significant digits after decimal point
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

function countSignificantDigits(value: string): number {
  const decimalIndex = value.indexOf('.');

  if (decimalIndex === -1) {
    return 0;
  }

  const fractionalPart = value.slice(decimalIndex + 1).replace(/^0+/, '');
  return fractionalPart.length;
}

export function getShortCurrencySymbol(currency?: ApiBaseCurrency) {
  if (!currency) currency = DEFAULT_PRICE_CURRENCY;
  return SHORT_CURRENCY_SYMBOL_MAP[currency as keyof typeof SHORT_CURRENCY_SYMBOL_MAP] ?? currency;
}

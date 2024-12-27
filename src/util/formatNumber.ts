import type { ApiBaseCurrency } from '../api/types';

import {
  DEFAULT_PRICE_CURRENCY,
  SHORT_CURRENCY_SYMBOL_MAP,
  WHOLE_PART_DELIMITER,
} from '../config';
import { Big } from '../lib/big.js';
import { toDecimal } from './decimals';
import withCache from './withCache';

const SHORT_SYMBOLS = new Set(Object.values(SHORT_CURRENCY_SYMBOL_MAP));

export const formatNumber = withCache((
  value: number | Big | string,
  fractionDigits = 2,
  noTruncate?: boolean,
) => {
  const bigValue = new Big(value);

  if (bigValue.eq(0)) return '0';

  const method = bigValue.lt(1) ? 'toPrecision' : 'round';
  const rounded = bigValue[method](fractionDigits, noTruncate ? Big.roundHalfUp : Big.roundDown)
    .toString()
    // Remove extra zeros after rounding to the specified accuracy
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '');

  return applyThousandsGrouping(rounded);
});

export function formatCurrency(
  value: number | string | Big,
  currency: string,
  fractionDigits?: number,
  noTruncate?: boolean,
) {
  const formatted = formatNumber(value, fractionDigits, noTruncate);
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

export function getShortCurrencySymbol(currency?: ApiBaseCurrency) {
  if (!currency) currency = DEFAULT_PRICE_CURRENCY;
  return SHORT_CURRENCY_SYMBOL_MAP[currency as keyof typeof SHORT_CURRENCY_SYMBOL_MAP] ?? currency;
}

function applyThousandsGrouping(str: string) {
  const [wholePart, fractionPart = ''] = str.split('.');
  const groupedWhole = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, `$&${WHOLE_PART_DELIMITER}`);

  return [groupedWhole, fractionPart].filter(Boolean).join('.');
}

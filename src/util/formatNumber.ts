import type { ApiBaseCurrency, ApiTokenWithPrice } from '../api/types';

import {
  DEFAULT_PRICE_CURRENCY,
  SHORT_CURRENCY_SYMBOL_MAP,
  WHOLE_PART_DELIMITER,
} from '../config';
import { Big } from '../lib/big.js';
import { bigintAbs } from './bigint';
import { toDecimal } from './decimals';
import withCache from './withCache';

const SHORT_SYMBOLS = new Set(Object.values(SHORT_CURRENCY_SYMBOL_MAP));

export const formatNumber = withCache((
  value: number | Big | string,
  fractionDigits = 2,
  noTruncate?: boolean,
) => {
  let bigValue = new Big(value);

  if (bigValue.eq(0)) return '0';

  const isNegative = bigValue.lt(0);
  if (isNegative) bigValue = bigValue.neg();

  const method = bigValue.lt(1) ? 'toPrecision' : 'round';
  let formatted = bigValue[method](fractionDigits, noTruncate ? Big.roundHalfUp : Big.roundDown)
    .toString()
    // Remove extra zeros after rounding to the specified accuracy
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '');

  formatted = applyThousandsGrouping(formatted);

  if (isNegative) formatted = `-${formatted}`;

  return formatted;
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
  value: number | string, currency: string, noSign = false, fractionDigits?: number, isZeroNegative?: boolean,
) {
  const numericValue = Number(value);
  const isNegative = numericValue === 0 ? isZeroNegative : (numericValue < 0);
  const prefix = !noSign ? (!isNegative ? '+\u202F' : '\u2212\u202F') : '';

  value = value.toString();
  return prefix + formatCurrency(noSign ? value : value.replace(/^-/, ''), currency, fractionDigits);
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

/** Formats the base currency amount of a transaction */
export function formatBaseCurrencyAmount(
  amount: bigint,
  baseCurrency: ApiBaseCurrency | undefined,
  token: Pick<ApiTokenWithPrice, 'decimals' | 'price'>,
) {
  const baseCurrencyAmount = Big(toDecimal(bigintAbs(amount), token.decimals, true)).mul(token.price);
  const shortBaseSymbol = getShortCurrencySymbol(baseCurrency);
  // The rounding logic should match the original amount rounding logic implemented by formatCurrencyExtended.
  // It's for cases when the base currency matches the transaction currency.
  return formatCurrency(baseCurrencyAmount, shortBaseSymbol);
}

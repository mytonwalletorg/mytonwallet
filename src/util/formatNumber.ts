import withCache from './withCache';

export const formatInteger = withCache((value: number, fractionDigits = 2) => {
  const fixed = value.toFixed(Math.min(fractionDigits, 100));
  let [wholePart, fractionPart] = fixed.split('.');

  fractionPart = fractionPart.replace(/0+$/, '');
  if (fractionPart === '') {
    wholePart = wholePart.replace(/^-0$/, '0');
  }
  wholePart = wholePart.replace(/\d(?=(\d{3})+($|\.))/g, '$&,');

  return [
    wholePart,
    fractionPart,
  ].filter(Boolean).join('.');
});

export function formatCurrency(value: number, currency: string, fractionDigits?: number) {
  const formatted = formatInteger(value, fractionDigits);
  return currency === '$' ? `$${formatted}` : `${formatted} ${currency}`;
}

export function formatCurrencyExtended(value: number, currency: string, noSign = false) {
  const integerLength = String(Math.round(value)).length;
  const prefix = !noSign ? (value > 0 ? '+\u202F' : '\u2212\u202F') : '';

  return prefix + formatCurrency(noSign ? value : Math.abs(value), currency, 10 - integerLength);
}

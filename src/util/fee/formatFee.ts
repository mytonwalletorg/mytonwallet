import type { UserToken } from '../../global/types';
import type { FeePrecision, FeeTerms } from './types';

import { STARS_SYMBOL } from '../../config';
import { toDecimal } from '../decimals';
import { formatCurrency } from '../formatNumber';

export type FormatFeeOptions = {
  terms: FeeTerms;
  /** The token acting as the transferred token in the `terms` object */
  token: FeeToken;
  /** The token acting as the native token in the `terms` object */
  nativeToken: FeeToken;
  /** Affects the sign indicating the fee precision and standing before the terms. */
  precision: FeePrecision;
};

type FeeToken = Pick<UserToken, 'symbol' | 'decimals'>;

type FeeListTerm = {
  tokenType: keyof FeeTerms;
  amount: bigint;
};

const TERM_SEPARATOR = ' + ';
const PRECISION_PREFIX: Record<FeePrecision, string> = {
  exact: '',
  approximate: '~\u202F',
  lessThan: '<\u202F',
};
const STARS_TOKEN = {
  symbol: STARS_SYMBOL,
  decimals: 0,
};

/**
 * Formats a complex fee (containing multiple terms) into a human-readable string
 */
export function formatFee({
  terms,
  token,
  nativeToken,
  precision,
}: FormatFeeOptions): string {
  let result = convertTermsObjectToList(terms)
    .map(({ tokenType, amount }) => {
      const currentToken = tokenType === 'stars' ? STARS_TOKEN : tokenType === 'native' ? nativeToken : token;
      return formatCurrency(toDecimal(amount, currentToken.decimals), currentToken.symbol, undefined, true);
    })
    .join(TERM_SEPARATOR);

  if (precision !== undefined) {
    result = PRECISION_PREFIX[precision] + result;
  }

  return result;
}

function convertTermsObjectToList(terms: FeeTerms) {
  const termList: FeeListTerm[] = [];
  let firstNonZeroTerm: FeeListTerm | undefined;

  for (const [tokenType, amount] of Object.entries(terms) as [keyof FeeTerms, bigint | undefined][]) {
    if (amount !== undefined) {
      const term = { tokenType, amount };

      if (amount !== 0n) {
        termList.push(term);
      } else if (!firstNonZeroTerm) {
        firstNonZeroTerm = term;
      }
    }
  }

  // Keeping at least 1 term for better UX
  if (termList.length === 0) {
    termList.push(firstNonZeroTerm ?? { tokenType: 'native', amount: 0n });
  }

  return termList;
}

/**
 * The BigInt assumes the token amount expressed in the minimal units of that token. The other types assume
 * human-readable numbers with decimal point.
 */
export type FeeValue = number | string | bigint;

/**
 * If any field value is 0, it should be ignored
 */
export type FeeTerms<T extends FeeValue = FeeValue> = {
  /** The fee part paid in the transferred token */
  token?: T;
  /** The fee part paid in the chain's native token */
  native?: T;
  /**
   * The fee part paid in stars.
   * The BigInt assumes 0 decimal places (i.e. the number is equal to the visible number of stars).
   */
  stars?: T;
};

export type FeePrecision = 'exact' | 'approximate' | 'lessThan';

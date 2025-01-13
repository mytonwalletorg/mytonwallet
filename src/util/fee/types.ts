/**
 * If any field value is 0, it should be ignored
 */
export type FeeTerms = {
  /** The fee part paid in the transferred token */
  token?: bigint;
  /** The fee part paid in the chain's native token */
  native?: bigint;
  /**
   * The fee part paid in stars.
   * The BigInt assumes 0 decimal places (i.e. the number is equal to the visible number of stars).
   */
  stars?: bigint;
};

export type FeePrecision = 'exact' | 'approximate' | 'lessThan';

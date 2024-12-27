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
   * The BigInt assumes the same number of decimal places as the transferred token.
   */
  stars?: bigint;
};

export type FeePrecision = 'exact' | 'approximate' | 'lessThan';

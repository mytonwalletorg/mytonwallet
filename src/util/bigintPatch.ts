import { BIGINT_PREFIX } from './bigint';

// Fixes serialization of objects containing `bigint` values.
// Extracted to a separate file to avoid leaking into Extension Page Script.
// @ts-ignore
BigInt.prototype.toJSON = function toJSON() {
  return `${BIGINT_PREFIX}${this.toString()}`;
};

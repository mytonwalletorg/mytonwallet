import type { ParsedTracePart } from '../chains/ton/types';
import type { ApiActivity } from './activity';

export type ApiEmulationResult = {
  networkFee: bigint;
  realFee: bigint;
  byTransactionIndex: ParsedTracePart[];
  /** What else should happen after submitting the transactions (in addition to the transactions and the returned TON) */
  activities: ApiActivity[];
};

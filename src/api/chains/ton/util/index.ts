import type { ApiAccountWithTon } from '../../../types';

import { bigintRandom, bigintReviver } from '../../../../util/bigint';
import { DEFAULT_MAX_MESSAGES, LEDGER_MAX_MESSAGES, W5_MAX_MESSAGES } from '../constants';

export function cloneDeep<T>(value: T): T {
  return JSON.parse(JSON.stringify(value), bigintReviver);
}

export function generateQueryId() {
  return bigintRandom(8);
}

/** How many messages can be sent in a single transaction */
export function getMaxMessagesInTransaction(account: ApiAccountWithTon) {
  const { type, ton: { version } } = account;

  if (type === 'ledger') {
    return LEDGER_MAX_MESSAGES;
  } else if (version === 'W5') {
    return W5_MAX_MESSAGES;
  } else {
    return DEFAULT_MAX_MESSAGES;
  }
}

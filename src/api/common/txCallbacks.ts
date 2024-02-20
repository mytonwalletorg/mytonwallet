import type { ApiTransactionActivity } from '../types';

import { createCallbackManager } from '../../util/callbacks';

export const txCallbacks = createCallbackManager();

export function whenTxComplete(normalizedAddress: string, amount: bigint) {
  return new Promise<{ result: boolean; transaction: ApiTransactionActivity }>((resolve) => {
    txCallbacks.addCallback(
      function callback(transaction: ApiTransactionActivity) {
        if (transaction.normalizedAddress === normalizedAddress && transaction.amount === -amount) {
          txCallbacks.removeCallback(callback);
          resolve({ result: true, transaction });
        }
      },
    );
  });
}

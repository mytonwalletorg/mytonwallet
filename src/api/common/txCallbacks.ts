import type { ApiTransactionActivity } from '../types';

import { createCallbackManager } from '../../util/callbacks';

export const txCallbacks = createCallbackManager();

export function whenTxComplete(toAddress: string, amount: string) {
  return new Promise<{ result: boolean; transaction: ApiTransactionActivity }>((resolve) => {
    txCallbacks.addCallback(
      function callback(transaction: ApiTransactionActivity) {
        if (transaction.toAddress === toAddress && transaction.amount === `-${amount}`) {
          txCallbacks.removeCallback(callback);
          resolve({ result: true, transaction });
        }
      },
    );
  });
}

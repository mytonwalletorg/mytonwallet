import { createCallbackManager } from '../../util/callbacks';
import { ApiTransaction } from '../types';

export const txCallbacks = createCallbackManager();

export function whenTxComplete(toAddress: string, amount: string) {
  return new Promise<{ result: boolean; txId: string }>((resolve) => {
    txCallbacks.addCallback(function callback(transaction: ApiTransaction) {
      if (transaction.toAddress === toAddress && transaction.amount === `-${amount}`) {
        txCallbacks.removeCallback(callback);
        resolve({ result: true, txId: transaction.txId });
      }
    });
  });
}

import { addActionHandler, setGlobal } from '../../index';

import { TransferState } from '../../types';
import { removeLocalTransaction, updateCurrentTransfer, updateTransaction } from '../../reducers';
import { bigStrToHuman, getIsTxIdLocal } from '../../helpers';

addActionHandler('apiUpdate', (global, actions, update) => {
  switch (update.type) {
    case 'newTransaction': {
      const {
        transaction,
        transaction: { amount, toAddress, txId },
      } = update;

      global = updateTransaction(global, transaction);

      const isLocal = getIsTxIdLocal(txId);
      if (
        isLocal
        && -bigStrToHuman(amount) === global.currentTransfer.amount
        && toAddress === global.currentTransfer.toAddress
      ) {
        global = updateCurrentTransfer(global, {
          txId,
          state: TransferState.Complete,
          isLoading: false,
        });
      }

      setGlobal(global);

      break;
    }

    case 'updateTxComplete': {
      const { txId, localTxId } = update;

      global = removeLocalTransaction(global, localTxId);

      if (global.currentTransfer.txId === localTxId) {
        global = updateCurrentTransfer(global, { txId });
      }

      if (global.currentTransactionId === localTxId) {
        global = {
          ...global,
          currentTransactionId: txId,
        };
      }

      setGlobal(global);
    }
  }
});

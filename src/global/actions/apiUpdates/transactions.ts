import { addActionHandler, setGlobal } from '../../index';

import { updateCurrentTransfer, removeLocalTransaction } from '../../reducers';
import { bigStrToHuman } from '../../helpers';

addActionHandler('apiUpdate', (global, actions, update) => {
  switch (update.type) {
    case 'updateTxComplete': {
      const {
        amount, toAddress, txId, localTxId,
      } = update;

      global = removeLocalTransaction(global, localTxId);

      if (global.currentTransactionId === localTxId) {
        global = {
          ...global,
          currentTransactionId: txId,
        };
      }

      if (bigStrToHuman(amount) === global.currentTransfer.amount && toAddress === global.currentTransfer.toAddress) {
        global = updateCurrentTransfer(global, { txId });
      }

      setGlobal(global);
    }
  }
});

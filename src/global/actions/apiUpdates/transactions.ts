import { TransferState } from '../../types';

import { addActionHandler, setGlobal } from '../../index';

import { updateCurrentTransfer } from '../../reducers';
import { bigStrToHuman } from '../../helpers';

addActionHandler('apiUpdate', (global, actions, update) => {
  switch (update.type) {
    case 'updateTxComplete': {
      const { amount, toAddress, txId } = update;
      if (bigStrToHuman(amount) !== global.currentTransfer.amount || toAddress !== global.currentTransfer.toAddress) {
        return;
      }

      setGlobal(updateCurrentTransfer(global, { state: TransferState.Complete, txId }));

      break;
    }
  }
});

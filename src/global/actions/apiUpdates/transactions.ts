import { addActionHandler, setGlobal } from '../../index';

import { TransferState } from '../../types';
import { DEFAULT_DECIMAL_PLACES, TINY_TRANSFER_MAX_AMOUNT } from '../../../config';
import {
  removeLocalTransaction,
  updateCurrentAccountState,
  updateCurrentTransfer,
  updateTransaction,
} from '../../reducers';
import { bigStrToHuman, getIsTxIdLocal } from '../../helpers';
import { selectCurrentAccountState } from '../../selectors';
import { playIncomingTransactionSound } from '../../../util/appSounds';

const TX_AGE_TO_PLAY_SOUND = 60000; // 1 min

addActionHandler('apiUpdate', (global, actions, update) => {
  switch (update.type) {
    case 'newTransaction': {
      const {
        transaction,
        transaction: { amount, toAddress, txId },
      } = update;
      const { decimals } = global.tokenInfo!.bySlug[transaction.slug!]!;

      global = updateTransaction(global, transaction);

      const isLocal = getIsTxIdLocal(txId);
      if (
        isLocal
        && -bigStrToHuman(amount, decimals) === global.currentTransfer.amount
        && toAddress === global.currentTransfer.toAddress
      ) {
        global = updateCurrentTransfer(global, {
          txId,
          state: TransferState.Complete,
          isLoading: false,
        });
      }

      if (
        transaction.isIncoming
        && global.settings.canPlaySounds
        && (Date.now() - transaction.timestamp < TX_AGE_TO_PLAY_SOUND)
        && (!global.settings.areTinyTransfersHidden
          || Math.abs(bigStrToHuman(
            transaction.amount,
            global.tokenInfo?.bySlug[transaction.slug!].decimals || DEFAULT_DECIMAL_PLACES,
          )) >= TINY_TRANSFER_MAX_AMOUNT
        )
      ) {
        playIncomingTransactionSound();
      }

      if (transaction.type === 'stake' || transaction.type === 'unstake') {
        actions.fetchStakingState();
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

      const { currentTransactionId } = selectCurrentAccountState(global) || {};
      if (currentTransactionId === localTxId) {
        global = updateCurrentAccountState(global, { currentTransactionId: txId });
      }

      setGlobal(global);
    }
  }
});

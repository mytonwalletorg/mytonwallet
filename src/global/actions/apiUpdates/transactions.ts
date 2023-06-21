import { TransferState } from '../../types';

import { DEFAULT_DECIMAL_PLACES, TINY_TRANSFER_MAX_AMOUNT } from '../../../config';
import { playIncomingTransactionSound } from '../../../util/appSounds';
import { bigStrToHuman } from '../../helpers';
import { addActionHandler, setGlobal } from '../../index';
import {
  removeTransaction,
  updateAccountState,
  updateCurrentTransfer,
  updateTransaction,
  updateTransactionsIsLoadingByAccount,
} from '../../reducers';
import { selectAccountState } from '../../selectors';

const TX_AGE_TO_PLAY_SOUND = 60000; // 1 min

addActionHandler('apiUpdate', (global, actions, update) => {
  switch (update.type) {
    case 'newLocalTransaction': {
      const {
        accountId,
        transaction,
        transaction: { amount, toAddress, txId },
      } = update;
      const { decimals } = global.tokenInfo!.bySlug[transaction.slug!]!;

      global = updateTransaction(global, accountId, transaction);

      if (
        -bigStrToHuman(amount, decimals) === global.currentTransfer.amount
        && toAddress === global.currentTransfer.toAddress
      ) {
        global = updateCurrentTransfer(global, {
          txId,
          state: TransferState.Complete,
          isLoading: false,
        });
      }

      if (transaction.type === 'stake' || transaction.type === 'unstake') {
        actions.fetchStakingState();
      }

      setGlobal(global);

      break;
    }

    case 'newTransactions': {
      const { transactions, accountId } = update;
      let shouldPlaySound = false;
      let wasStakingTransaction = false;

      global = updateTransactionsIsLoadingByAccount(global, accountId, false);

      for (const transaction of transactions) {
        global = updateTransaction(global, accountId, transaction);

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
          shouldPlaySound = true;
        }

        if (transaction.type === 'stake' || transaction.type === 'unstake') {
          wasStakingTransaction = true;
        }
      }

      if (shouldPlaySound) {
        playIncomingTransactionSound();
      }

      if (wasStakingTransaction) {
        actions.fetchStakingState();
      }

      setGlobal(global);

      break;
    }

    case 'updateTxComplete': {
      const { txId, localTxId, accountId } = update;

      global = removeTransaction(global, accountId, localTxId);

      if (global.currentTransfer.txId === localTxId) {
        global = updateCurrentTransfer(global, { txId });
      }

      const { currentTransactionId } = selectAccountState(global, accountId) || {};
      if (currentTransactionId === localTxId) {
        global = updateAccountState(global, accountId, { currentTransactionId: txId });
      }

      setGlobal(global);
    }
  }
});

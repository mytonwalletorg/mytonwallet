import { TransferState } from '../../types';

import { playIncomingTransactionSound } from '../../../util/appSounds';
import { bigStrToHuman, getIsTinyTransaction } from '../../helpers';
import { addActionHandler, setGlobal } from '../../index';
import {
  removeTransaction,
  updateAccountState,
  updateActivitiesIsLoadingByAccount,
  updateActivity,
  updateCurrentTransfer,
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

      global = updateActivity(global, accountId, transaction);

      if (
        -bigStrToHuman(amount, decimals) === global.currentTransfer.amount
        && toAddress === global.currentTransfer.normalizedAddress
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

    case 'newActivities': {
      const { activities, accountId } = update;
      let shouldPlaySound = false;
      let wasStakingTransaction = false;

      global = updateActivitiesIsLoadingByAccount(global, accountId, false);

      for (const activity of activities) {
        global = updateActivity(global, accountId, activity);

        if (
          activity.isIncoming
          && global.settings.canPlaySounds
          && (Date.now() - activity.timestamp < TX_AGE_TO_PLAY_SOUND)
          && (
            !global.settings.areTinyTransfersHidden
            || getIsTinyTransaction(activity, global.tokenInfo?.bySlug[activity.slug!])
          )
        ) {
          shouldPlaySound = true;
        }

        if (activity.type === 'stake' || activity.type === 'unstake') {
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

      const { currentActivityId } = selectAccountState(global, accountId) || {};
      if (currentActivityId === localTxId) {
        global = updateAccountState(global, accountId, { currentActivityId: txId });
      }

      setGlobal(global);
    }
  }
});

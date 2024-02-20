import { TransferState } from '../../types';

import { IS_CAPACITOR } from '../../../config';
import { compareActivities } from '../../../util/compareActivities';
import { playIncomingTransactionSound } from '../../../util/notificationSound';
import { getIsTinyTransaction } from '../../helpers';
import { addActionHandler, setGlobal } from '../../index';
import {
  addLocalTransaction,
  assignRemoteTxId,
  clearIsPinAccepted,
  removeLocalTransaction,
  updateAccountState,
  updateActivitiesIsLoadingByAccount,
  updateActivity,
  updateCurrentTransfer,
} from '../../reducers';
import { selectAccountState, selectLocalTransactions } from '../../selectors';

const TX_AGE_TO_PLAY_SOUND = 60000; // 1 min

addActionHandler('apiUpdate', (global, actions, update) => {
  switch (update.type) {
    case 'newLocalTransaction': {
      const {
        accountId,
        transaction,
        transaction: { amount, txId },
      } = update;

      global = updateActivity(global, accountId, transaction);
      global = addLocalTransaction(global, accountId, transaction);

      if (-amount === global.currentTransfer.amount) {
        global = updateCurrentTransfer(global, {
          txId,
          state: TransferState.Complete,
          isLoading: false,
        });
        if (IS_CAPACITOR) {
          global = clearIsPinAccepted(global);
        }
      }

      setGlobal(global);

      break;
    }

    case 'newActivities': {
      const { accountId } = update;
      const activities = update.activities.sort((a, b) => compareActivities(a, b, true));

      let shouldPlaySound = false;

      global = updateActivitiesIsLoadingByAccount(global, accountId, false);

      const localTransactions = selectLocalTransactions(global, accountId) ?? [];

      for (const activity of activities) {
        if (activity.kind === 'transaction') {
          const localTransaction = localTransactions.find(({
            amount, isIncoming, slug, normalizedAddress,
          }) => {
            return amount === activity.amount && !isIncoming && slug === activity.slug
              && normalizedAddress === activity.normalizedAddress;
          });

          if (localTransaction) {
            const { txId } = activity;
            const localTxId = localTransaction.txId;
            global = assignRemoteTxId(global, accountId, localTxId, txId);

            if (global.currentTransfer.txId === localTxId) {
              global = updateCurrentTransfer(global, { txId });
            }

            const { currentActivityId } = selectAccountState(global, accountId) || {};
            if (currentActivityId === localTxId) {
              global = updateAccountState(global, accountId, { currentActivityId: txId });
            }

            global = removeLocalTransaction(global, accountId, localTxId);

            continue;
          }
        }

        global = updateActivity(global, accountId, activity);

        if (activity.kind === 'swap') {
          continue;
        }

        if (
          activity.isIncoming
          && global.settings.canPlaySounds
          && (Date.now() - activity.timestamp < TX_AGE_TO_PLAY_SOUND)
          && !(
            global.settings.areTinyTransfersHidden
            && getIsTinyTransaction(activity, global.tokenInfo?.bySlug[activity.slug!])
          )
        ) {
          shouldPlaySound = true;
        }
      }

      if (shouldPlaySound) {
        playIncomingTransactionSound();
      }

      setGlobal(global);

      break;
    }
  }
});

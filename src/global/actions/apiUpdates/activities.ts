import type { ApiTransactionActivity } from '../../../api/types';
import { TransferState } from '../../types';

import { IS_CAPACITOR, TONCOIN } from '../../../config';
import { groupBy } from '../../../util/iteratees';
import { callActionInMain, callActionInNative } from '../../../util/multitab';
import { playIncomingTransactionSound } from '../../../util/notificationSound';
import { getIsTransactionWithPoisoning } from '../../../util/poisoningHash';
import { getIsTonToken } from '../../../util/tokens';
import { IS_DELEGATED_BOTTOM_SHEET, IS_DELEGATING_BOTTOM_SHEET } from '../../../util/windowEnvironment';
import { getIsTinyOrScamTransaction, getRealTxIdFromLocal } from '../../helpers';
import { addActionHandler, setGlobal } from '../../index';
import {
  addLocalTransaction,
  addNewActivities,
  clearIsPinAccepted,
  removeLocalTransaction,
  replaceLocalTransaction,
  setIsFirstActivitiesLoadedTrue,
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

        if (getIsTonToken(transaction.slug)) {
          actions.fetchTransferDieselState({ tokenSlug: transaction.slug });
        }
      }

      setGlobal(global);

      break;
    }

    case 'newActivities': {
      if (IS_DELEGATING_BOTTOM_SHEET && !update.noForward) {
        // Local transaction in NBS was not updated after nft/transfer sending was completed
        callActionInNative('apiUpdate', { ...update, noForward: true });
      }
      if (IS_DELEGATED_BOTTOM_SHEET && !update.noForward) {
        // A local swap transaction is not created if the NBS is closed before the exchange is completed
        callActionInMain('apiUpdate', { ...update, noForward: true });
      }
      const { accountId, activities, chain } = update;

      global = updateActivitiesIsLoadingByAccount(global, accountId, false);

      const localTransactions = selectLocalTransactions(global, accountId) ?? [];
      const withLocalIndex = activities.map((activity) => {
        if (activity.kind !== 'transaction') {
          return { activity, localIndex: -1, groupName: 'newActivities' };
        }

        const localIndex = localTransactions.findIndex(({
          txId, amount, isIncoming, slug, normalizedAddress, inMsgHash,
        }) => {
          if (getRealTxIdFromLocal(txId) === activity.txId) {
            return true;
          } else if (slug === TONCOIN.slug) {
            return inMsgHash === activity.inMsgHash && normalizedAddress === activity.normalizedAddress;
          } else {
            return amount === activity.amount && !isIncoming && slug === activity.slug
              && normalizedAddress === activity.normalizedAddress;
          }
        });

        return { activity, localIndex, groupName: localIndex >= 0 ? 'localUpdates' : 'newActivities' };
      });

      const groups = groupBy(withLocalIndex, 'groupName');

      groups.localUpdates?.forEach(({ activity, localIndex }) => {
        const [localTransaction] = localTransactions.splice(localIndex, 1);

        const { txId } = activity as ApiTransactionActivity;
        const localTxId = localTransaction.txId;
        global = replaceLocalTransaction(global, accountId, localTxId, activity as ApiTransactionActivity);

        if (global.currentTransfer.txId === localTxId) {
          global = updateCurrentTransfer(global, { txId });
        }

        const { currentActivityId } = selectAccountState(global, accountId) || {};
        if (currentActivityId === localTxId) {
          global = updateAccountState(global, accountId, { currentActivityId: txId });
        }

        global = removeLocalTransaction(global, accountId, localTxId);
      });

      if (groups.newActivities) {
        const newActivities = groups.newActivities.map(({ activity }) => activity);

        global = addNewActivities(global, accountId, newActivities);

        const shouldPlaySound = newActivities.some((activity) => {
          return activity.kind === 'transaction'
            && activity.isIncoming
            && global.settings.canPlaySounds
            && (Date.now() - activity.timestamp < TX_AGE_TO_PLAY_SOUND)
            && !(
              global.settings.areTinyTransfersHidden
              && getIsTinyOrScamTransaction(activity, global.tokenInfo?.bySlug[activity.slug!])
            )
            && !getIsTransactionWithPoisoning(activity);
        });

        if (shouldPlaySound) {
          playIncomingTransactionSound();
        }
      }

      if (chain) {
        global = setIsFirstActivitiesLoadedTrue(global, accountId, chain);
      }

      setGlobal(global);
      break;
    }
  }
});

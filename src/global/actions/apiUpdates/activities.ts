import type { ApiActivity, ApiTransactionActivity } from '../../../api/types';
import type { GlobalState } from '../../types';
import { TransferState } from '../../types';

import {
  IS_CORE_WALLET,
  MINT_CARD_ADDRESS,
  MINT_CARD_REFUND_COMMENT,
  MTW_CARDS_COLLECTION,
} from '../../../config';
import { doesLocalActivityMatch, getActivityIdReplacements } from '../../../util/activities';
import { getDoesUsePinPad } from '../../../util/biometrics';
import { callActionInMain, callActionInNative } from '../../../util/multitab';
import { playIncomingTransactionSound } from '../../../util/notificationSound';
import { getIsTransactionWithPoisoning } from '../../../util/poisoningHash';
import { getIsTonToken } from '../../../util/tokens';
import {
  IS_DELEGATED_BOTTOM_SHEET,
  IS_DELEGATING_BOTTOM_SHEET,
} from '../../../util/windowEnvironment';
import { getIsTinyOrScamTransaction } from '../../helpers';
import { addActionHandler, getActions, setGlobal } from '../../index';
import {
  addNewActivities,
  addNft,
  clearIsPinAccepted,
  putInitialActivities,
  removeActivities,
  replaceCurrentActivityId,
  replaceCurrentDomainLinkingId,
  replaceCurrentDomainRenewalId,
  replaceCurrentSwapId,
  replaceCurrentTransferId,
  replacePendingActivities,
  setIsInitialActivitiesLoadedTrue,
  updateAccountState,
  updateActivitiesIsLoadingByAccount,
  updateCurrentTransfer,
} from '../../reducers';
import {
  selectAccountState,
  selectLocalActivitiesSlow,
  selectPendingActivitiesSlow,
  selectRecentNonLocalActivitiesSlow,
} from '../../selectors';

const TX_AGE_TO_PLAY_SOUND = 60000; // 1 min

addActionHandler('apiUpdate', (global, actions, update) => {
  switch (update.type) {
    case 'initialActivities': {
      const { accountId, mainActivities, bySlug, chain } = update;

      global = updateActivitiesIsLoadingByAccount(global, accountId, false);
      global = putInitialActivities(global, accountId, mainActivities, bySlug);

      if (chain) {
        global = setIsInitialActivitiesLoadedTrue(global, accountId, chain);
      }

      setGlobal(global);
      break;
    }

    case 'newLocalActivities': {
      const {
        accountId,
        activities,
      } = update;

      hideOutdatedLocalActivities(global, accountId, activities);
      global = addNewActivities(global, accountId, activities);

      for (const activity of activities) {
        if (activity.kind === 'transaction' && -activity.amount === global.currentTransfer.amount) {
          global = updateCurrentTransfer(global, {
            txId: activity.txId,
            state: TransferState.Complete,
            isLoading: false,
          });

          if (getDoesUsePinPad()) {
            global = clearIsPinAccepted(global);
          }

          if (getIsTonToken(activity.slug)) {
            actions.fetchTransferDieselState({ tokenSlug: activity.slug });
          }
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
      const { accountId, activities: newConfirmedActivities, pendingActivities, chain } = update;

      const replacedIds = getActivityIdReplacements(
        [
          ...selectLocalActivitiesSlow(global, accountId),
          ...(chain ? selectPendingActivitiesSlow(global, accountId, chain) : []),
        ],
        [
          ...(pendingActivities ?? []),
          ...newConfirmedActivities,
        ],
      );

      // A good TON address for testing: UQD5mxRgCuRNLxKxeOjG6r14iSroLF5FtomPnet-sgP5xI-e
      global = removeActivities(global, accountId, Object.keys(replacedIds));
      if (chain && pendingActivities !== undefined) {
        global = replacePendingActivities(global, accountId, chain, pendingActivities);
      }
      global = addNewActivities(global, accountId, newConfirmedActivities);

      global = replaceCurrentTransferId(global, replacedIds);
      global = replaceCurrentDomainLinkingId(global, replacedIds);
      global = replaceCurrentDomainRenewalId(global, replacedIds);
      global = replaceCurrentSwapId(global, replacedIds);
      global = replaceCurrentActivityId(global, accountId, replacedIds);
      notifyAboutNewActivities(global, newConfirmedActivities);

      if (!IS_CORE_WALLET) {
        // NFT polling is executed at long intervals, so it is more likely that a user will see a new transaction
        // rather than receiving a card in the collection. Therefore, when a new activity occurs,
        // we check for a card from the MyTonWallet collection and apply it.
        global = processCardMintingActivity(global, accountId, newConfirmedActivities);
      }

      global = updateActivitiesIsLoadingByAccount(global, accountId, false);
      if (chain) {
        global = setIsInitialActivitiesLoadedTrue(global, accountId, chain);
      }

      setGlobal(global);
      break;
    }
  }
});

function notifyAboutNewActivities(global: GlobalState, newActivities: ApiActivity[]) {
  if (!global.settings.canPlaySounds) {
    return;
  }

  const shouldPlaySound = newActivities.some((activity) => {
    return activity.kind === 'transaction'
      && activity.isIncoming
      && !activity.isPending
      && (Date.now() - activity.timestamp < TX_AGE_TO_PLAY_SOUND)
      && !(
        global.settings.areTinyTransfersHidden
        && getIsTinyOrScamTransaction(activity, global.tokenInfo?.bySlug[activity.slug])
      )
      && !getIsTransactionWithPoisoning(activity);
  });

  if (shouldPlaySound) {
    playIncomingTransactionSound();
  }
}

function processCardMintingActivity(global: GlobalState, accountId: string, activities: ApiActivity[]): GlobalState {
  const { isCardMinting } = selectAccountState(global, accountId) || {};

  if (!isCardMinting || !activities.length) {
    return global;
  }

  const mintCardActivity = activities.find((activity) => {
    return activity.kind === 'transaction'
      && activity.isIncoming
      && activity?.nft?.collectionAddress === MTW_CARDS_COLLECTION;
  });

  const refundActivity = activities.find((activity) => {
    return activity.kind === 'transaction'
      && activity.isIncoming
      && activity.fromAddress === MINT_CARD_ADDRESS
      && activity?.comment === MINT_CARD_REFUND_COMMENT;
  });

  if (mintCardActivity) {
    const nft = (mintCardActivity as ApiTransactionActivity).nft!;

    global = updateAccountState(global, accountId, { isCardMinting: undefined });
    global = addNft(global, accountId, nft);
    getActions().setCardBackgroundNft({ nft });
    getActions().installAccentColorFromNft({ nft });
  } else if (refundActivity) {
    global = updateAccountState(global, accountId, { isCardMinting: undefined });
  }

  return global;
}

/**
 * Thanks to the socket, there is a possibility that a pending activity will arrive before the corresponding local
 * activity. Such local activities duplicate the pending activities, which is unwanted. They shouldn't be removed,
 * because other parts of the global state may point to their ids, so they get hidden instead.
 */
function hideOutdatedLocalActivities(global: GlobalState, accountId: string, localActivities: ApiActivity[]) {
  const maxCheckDepth = localActivities.length + 20;
  const chainActivities = selectRecentNonLocalActivitiesSlow(global, accountId, maxCheckDepth);

  for (const localActivity of localActivities) {
    localActivity.shouldHide ||= chainActivities.some((chainActivity) => {
      return doesLocalActivityMatch(localActivity, chainActivity);
    });
  }

  return localActivities;
}

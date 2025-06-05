import type { ApiActivity, ApiTransactionActivity } from '../../../api/types';
import type { GlobalState } from '../../types';
import { TransferState } from '../../types';

import {
  IS_CORE_WALLET,
  MINT_CARD_ADDRESS,
  MINT_CARD_REFUND_COMMENT,
  MTW_CARDS_COLLECTION,
} from '../../../config';
import { parseTxId } from '../../../util/activities';
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
  setIsInitialActivitiesLoadedTrue,
  updateAccountState,
  updateActivitiesIsLoadingByAccount,
  updateCurrentTransfer,
} from '../../reducers';
import { selectAccountState, selectLocalActivities } from '../../selectors';

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

    case 'newLocalActivity': {
      const {
        accountId,
        activity,
      } = update;

      global = addNewActivities(global, accountId, [activity]);

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
      const { accountId, activities: incomingActivities, chain } = update;

      global = updateActivitiesIsLoadingByAccount(global, accountId, false);

      const localActivities = selectLocalActivities(global, accountId) ?? [];
      const { replacedLocalIds, newActivities } = splitReplacedAndNewActivities(localActivities, incomingActivities);

      global = removeActivities(global, accountId, replacedLocalIds.keys());
      global = addNewActivities(global, accountId, incomingActivities);

      global = replaceCurrentTransferId(global, replacedLocalIds);
      global = replaceCurrentDomainLinkingId(global, replacedLocalIds);
      global = replaceCurrentDomainRenewalId(global, replacedLocalIds);
      global = replaceCurrentSwapId(global, replacedLocalIds);
      global = replaceCurrentActivityId(global, accountId, replacedLocalIds);
      notifyAboutNewActivities(global, newActivities);

      if (!IS_CORE_WALLET) {
        // NFT polling is executed at long intervals, so it is more likely that a user will see a new transaction
        // rather than receiving a card in the collection. Therefore, when a new activity occurs,
        // we check for a card from the MyTonWallet collection and apply it.
        global = processCardMintingActivity(global, accountId, incomingActivities);
      }

      if (chain) {
        global = setIsInitialActivitiesLoadedTrue(global, accountId, chain);
      }

      setGlobal(global);
      break;
    }
  }
});

/**
 * Finds the ids of the local activities that match any of the new blockchain activities (those are to be replaced).
 * Also finds the ids of the blockchain activities that have no matching local activities (those are to be notified about).
 */
function splitReplacedAndNewActivities(localActivities: ApiActivity[], incomingActivities: ApiActivity[]) {
  const replacedLocalIds = new Map<string, string>();
  const newActivities: ApiActivity[] = [];

  for (const incomingActivity of incomingActivities) {
    let hasLocalMatch = false;

    for (const localActivity of localActivities) {
      if (doesLocalActivityMatch(localActivity, incomingActivity)) {
        replacedLocalIds.set(localActivity.id, incomingActivity.id);
        hasLocalMatch = true;
      }
    }

    if (!hasLocalMatch) {
      newActivities.push(incomingActivity);
    }
  }

  return { replacedLocalIds, newActivities };
}

/** Decides whether the local activity matches the activity from the blockchain */
function doesLocalActivityMatch(localActivity: ApiActivity, chainActivity: ApiActivity) {
  if (localActivity.extra?.withW5Gasless) {
    if (localActivity.kind === 'transaction' && chainActivity.kind === 'transaction') {
      return !chainActivity.isIncoming && localActivity.normalizedAddress === chainActivity.normalizedAddress
        && localActivity.amount === chainActivity.amount
        && localActivity.slug === chainActivity.slug;
    } else if (localActivity.kind === 'swap' && chainActivity.kind === 'swap') {
      return localActivity.from === chainActivity.from
        && localActivity.to === chainActivity.to
        && localActivity.fromAmount === chainActivity.fromAmount;
    }
  }

  if (localActivity.externalMsgHash) {
    return localActivity.externalMsgHash === chainActivity.externalMsgHash && !chainActivity.shouldHide;
  }

  return parseTxId(localActivity.id).hash === parseTxId(chainActivity.id).hash;
}

function notifyAboutNewActivities(global: GlobalState, newActivities: ApiActivity[]) {
  if (!global.settings.canPlaySounds) {
    return;
  }

  const shouldPlaySound = newActivities.some((activity) => {
    return activity.kind === 'transaction'
      && activity.isIncoming
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

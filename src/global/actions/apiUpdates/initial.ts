import type { ApiChain, ApiLiquidStakingState } from '../../../api/types';

import { DEFAULT_STAKING_STATE, MTW_CARDS_COLLECTION } from '../../../config';
import { areDeepEqual } from '../../../util/areDeepEqual';
import { buildCollectionByKey } from '../../../util/iteratees';
import { callActionInNative } from '../../../util/multitab';
import { openUrl } from '../../../util/openUrl';
import { IS_DELEGATING_BOTTOM_SHEET, IS_IOS_APP } from '../../../util/windowEnvironment';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  addNft,
  removeNft,
  updateAccount,
  updateAccountSettingsBackgroundNft,
  updateAccountStaking,
  updateAccountState,
  updateBalances,
  updateNft,
  updateRestrictions,
  updateSettings,
  updateStakingDefault,
  updateStakingInfo,
  updateSwapTokens,
  updateTokens,
  updateVesting,
  updateVestingInfo,
} from '../../reducers';
import { selectAccountNftByAddress, selectAccountState, selectVestingPartsReadyToUnfreeze } from '../../selectors';

addActionHandler('apiUpdate', (global, actions, update) => {
  switch (update.type) {
    case 'updateBalances': {
      global = updateBalances(global, update.accountId, update.chain, update.balances);
      setGlobal(global);
      break;
    }

    case 'updateStaking': {
      const {
        accountId,
        states,
        common,
        totalProfit,
        shouldUseNominators,
      } = update;

      const stateById = buildCollectionByKey(states, 'id');

      global = updateStakingDefault(global, {
        ...stateById[DEFAULT_STAKING_STATE.id] as ApiLiquidStakingState,
        balance: 0n,
        unstakeRequestAmount: 0n,
        tokenBalance: 0n,
        isUnstakeRequested: false,
      });
      global = updateStakingInfo(global, common);
      global = updateAccountStaking(global, accountId, {
        stateById,
        shouldUseNominators,
        totalProfit,
      });

      const { stakingId } = selectAccountState(global, accountId)?.staking ?? {};

      if (!stakingId) {
        const stateWithBiggestBalance = [...states].sort(
          (state0, state1) => Number(state1.balance - state0.balance),
        )[0];

        if (stateWithBiggestBalance && stateWithBiggestBalance.balance > 0n) {
          global = updateAccountStaking(global, accountId, {
            stakingId: stateWithBiggestBalance.id,
          });
        }
      }

      setGlobal(global);
      break;
    }

    case 'updateTokens': {
      const { tokens, baseCurrency } = update;
      global = updateTokens(global, tokens, true);
      global = updateSettings(global, {
        baseCurrency,
      });
      setGlobal(global);
      break;
    }

    case 'updateSwapTokens': {
      global = updateSwapTokens(global, update.tokens);
      setGlobal(global);

      break;
    }

    case 'updateNfts': {
      const { accountId } = update;
      const nfts = buildCollectionByKey(update.nfts, 'address');
      global = getGlobal();
      const currentNfts = selectAccountState(global, accountId)?.nfts;
      global = updateAccountState(global, accountId, {
        nfts: {
          ...currentNfts,
          byAddress: nfts,
          orderedAddresses: Object.keys(nfts),
        },
      });

      update.nfts.forEach((nft) => {
        if (nft.collectionAddress === MTW_CARDS_COLLECTION) {
          global = updateAccountSettingsBackgroundNft(global, nft);
        }
      });
      setGlobal(global);

      actions.checkCardNftOwnership();
      break;
    }

    case 'nftSent': {
      const { accountId, nftAddress, newOwnerAddress } = update;
      const sentNft = selectAccountNftByAddress(global, accountId, nftAddress);
      global = removeNft(global, accountId, nftAddress);

      if (sentNft?.collectionAddress === MTW_CARDS_COLLECTION) {
        sentNft.ownerAddress = newOwnerAddress;
        global = updateAccountSettingsBackgroundNft(global, sentNft);
      }
      setGlobal(global);

      actions.checkCardNftOwnership();
      break;
    }

    case 'nftReceived': {
      const { accountId, nft } = update;
      global = addNft(global, accountId, nft);
      if (nft.collectionAddress === MTW_CARDS_COLLECTION) {
        global = updateAccountSettingsBackgroundNft(global, nft);
      }
      setGlobal(global);

      actions.checkCardNftOwnership();
      break;
    }

    case 'nftPutUpForSale': {
      const { accountId, nftAddress } = update;
      global = updateNft(global, accountId, nftAddress, {
        isOnSale: true,
      });
      setGlobal(global);
      break;
    }

    case 'updateAccount': {
      const { accountId, partial } = update;
      global = updateAccount(global, accountId, {
        addressByChain: {
          ton: partial.address,
        } as Record<ApiChain, string>,
      });
      setGlobal(global);
      break;
    }

    case 'updateConfig': {
      const {
        isLimited: isLimitedRegion,
        isCopyStorageEnabled,
        supportAccountsCount,
        countryCode,
        isAppUpdateRequired,
      } = update;

      global = updateRestrictions(global, {
        isLimitedRegion,
        isSwapDisabled: IS_IOS_APP && isLimitedRegion,
        isOnRampDisabled: IS_IOS_APP && isLimitedRegion,
        isNftBuyingDisabled: IS_IOS_APP && isLimitedRegion,
        isCopyStorageEnabled,
        supportAccountsCount,
        countryCode,
      });
      global = { ...global, isAppUpdateRequired };
      setGlobal(global);
      break;
    }

    case 'updateWalletVersions': {
      if (IS_DELEGATING_BOTTOM_SHEET) {
        callActionInNative('apiUpdateWalletVersions', update);
      }

      actions.apiUpdateWalletVersions(update);
      break;
    }

    case 'openUrl': {
      openUrl(update.url, update.isExternal, update.title, update.subtitle);
      break;
    }

    case 'requestReconnectApi': {
      actions.initApi();
      break;
    }

    case 'incorrectTime': {
      if (!global.isIncorrectTimeNotificationReceived) {
        actions.showIncorrectTimeError();
      }
      break;
    }

    case 'updateVesting': {
      const { accountId, vestingInfo } = update;
      const unfreezeRequestedIds = selectVestingPartsReadyToUnfreeze(global, accountId);
      global = updateVestingInfo(global, accountId, vestingInfo);
      const newUnfreezeRequestedIds = selectVestingPartsReadyToUnfreeze(global, accountId);
      if (!areDeepEqual(unfreezeRequestedIds, newUnfreezeRequestedIds)) {
        global = updateVesting(global, accountId, { unfreezeRequestedIds: undefined });
      }
      setGlobal(global);
      break;
    }

    case 'updatingStatus': {
      const { kind, isUpdating } = update;
      const key = kind === 'balance' ? 'balanceUpdateStartedAt' : 'activitiesUpdateStartedAt';
      if (isUpdating && global[key]) break;

      setGlobal({
        ...global,
        [key]: isUpdating ? Date.now() : undefined,
      });
      break;
    }
  }
});

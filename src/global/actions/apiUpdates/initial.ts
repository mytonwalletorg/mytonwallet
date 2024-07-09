import { StakingState } from '../../types';

import { areDeepEqual } from '../../../util/areDeepEqual';
import { buildCollectionByKey, pick } from '../../../util/iteratees';
import { openUrl } from '../../../util/openUrl';
import { IS_IOS_APP } from '../../../util/windowEnvironment';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  addNft,
  removeNft,
  updateAccount,
  updateAccountStakingState,
  updateAccountState,
  updateBalances,
  updateNft,
  updateRestrictions,
  updateSettings,
  updateStaking,
  updateStakingInfo,
  updateSwapTokens,
  updateTokens,
  updateVesting,
  updateVestingInfo,
} from '../../reducers';
import { selectAccountState, selectVestingPartsReadyToUnfreeze } from '../../selectors';

addActionHandler('apiUpdate', (global, actions, update) => {
  switch (update.type) {
    case 'updateBalances': {
      global = updateBalances(global, update.accountId, update.balancesToUpdate);
      setGlobal(global);

      actions.updateDeletionListForActiveTokens({ accountId: update.accountId });
      break;
    }

    case 'updateStaking': {
      const {
        accountId,
        stakingCommonData,
        stakingState,
        backendStakingState,
      } = update;

      const oldBalance = selectAccountState(global, accountId)?.staking?.balance ?? 0n;
      let balance = 0n;

      if (stakingState.type === 'nominators') {
        balance = stakingState.amount;
        global = updateAccountStakingState(global, accountId, {
          type: stakingState.type,
          balance,
          isUnstakeRequested: stakingState.isUnstakeRequested,
          unstakeRequestedAmount: undefined,
          apy: backendStakingState.nominatorsPool.apy,
          start: backendStakingState.nominatorsPool.start,
          end: backendStakingState.nominatorsPool.end,
          totalProfit: backendStakingState.totalProfit,
        }, true);
      } else {
        const isPrevRoundUnlocked = Date.now() > stakingCommonData.prevRound.unlock;

        balance = stakingState.amount;
        global = updateAccountStakingState(global, accountId, {
          type: stakingState.type,
          balance,
          isUnstakeRequested: !!stakingState.unstakeRequestAmount,
          unstakeRequestedAmount: stakingState.unstakeRequestAmount,
          start: isPrevRoundUnlocked ? stakingCommonData.round.start : stakingCommonData.prevRound.start,
          end: isPrevRoundUnlocked ? stakingCommonData.round.unlock : stakingCommonData.prevRound.unlock,
          apy: stakingState.apy,
          totalProfit: backendStakingState.totalProfit,
        }, true);

        global = updateStakingInfo(global, {
          liquid: {
            instantAvailable: stakingState.instantAvailable,
          },
        });
      }

      let shouldOpenStakingInfo = false;
      if (balance !== oldBalance && global.staking.state !== StakingState.None) {
        if (balance === 0n) {
          global = updateStaking(global, { state: StakingState.StakeInitial });
        } else if (oldBalance === 0n) {
          shouldOpenStakingInfo = true;
        }
      }

      setGlobal(global);

      if (shouldOpenStakingInfo) {
        actions.cancelStaking();
        actions.openStakingInfo();
      }
      break;
    }

    case 'updateTokens': {
      const { tokens, baseCurrency } = update;
      global = updateTokens(global, tokens, true);
      global = updateSettings(global, {
        baseCurrency,
      });
      setGlobal(global);

      actions.updateDeletionListForActiveTokens();
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
      setGlobal(global);
      break;
    }

    case 'nftSent': {
      const { accountId, nftAddress } = update;
      global = removeNft(global, accountId, nftAddress);
      setGlobal(global);
      break;
    }

    case 'nftReceived': {
      const { accountId, nft } = update;
      global = addNft(global, accountId, nft);
      setGlobal(global);
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
      global = updateAccount(global, accountId, pick(partial, ['address']));
      setGlobal(global);
      break;
    }

    case 'updateConfig': {
      const {
        isLimited: isLimitedRegion,
        isCopyStorageEnabled,
        supportAccountsCount,
        countryCode,
      } = update;

      global = updateRestrictions(global, {
        isLimitedRegion,
        isSwapDisabled: IS_IOS_APP && isLimitedRegion,
        isOnRampDisabled: IS_IOS_APP && isLimitedRegion,
        isCopyStorageEnabled,
        supportAccountsCount,
        countryCode,
      });
      setGlobal(global);
      break;
    }

    case 'updateWalletVersions': {
      const { accountId, versions, currentVersion } = update;
      global = {
        ...global,
        walletVersions: {
          ...global.walletVersions,
          currentVersion,
          byId: {
            ...global.walletVersions?.byId,
            [accountId]: versions,
          },
        },
      };
      setGlobal(global);
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

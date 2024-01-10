import { StakingState } from '../../types';

import { buildCollectionByKey, pick } from '../../../util/iteratees';
import { IS_IOS_APP } from '../../../util/windowEnvironment';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  addNft,
  removeNft,
  updateAccount,
  updateAccountStakingState,
  updateAccountState,
  updateBalance,
  updateBalances,
  updateNft,
  updateRestrictions,
  updateSettings,
  updateStaking,
  updateStakingInfo,
  updateSwapTokens,
  updateTokens,
} from '../../reducers';
import { selectAccountState } from '../../selectors';

addActionHandler('apiUpdate', (global, actions, update) => {
  switch (update.type) {
    case 'updateBalance': {
      global = updateBalance(global, update.accountId, update.slug, update.balance);
      setGlobal(global);

      actions.updateDeletionListForActiveTokens({ accountId: update.accountId });
      break;
    }

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

      const oldBalance = selectAccountState(global, accountId)?.staking?.balance ?? 0;
      let balance = 0;

      if (stakingState.type === 'nominators') {
        balance = stakingState.amount + stakingState.pendingDepositAmount;
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
          unstakeRequestedAmount: Number(stakingState.unstakeRequestAmount),
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
        if (balance === 0) {
          global = updateStaking(global, { state: StakingState.StakeInitial });
        } else if (oldBalance === 0) {
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
      global = updateAccountState(global, accountId, {
        nfts: {
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

    case 'updateRegion': {
      const { isLimited: isLimitedRegion } = update;

      global = updateRestrictions(global, {
        isLimitedRegion,
        isSwapDisabled: IS_IOS_APP && isLimitedRegion,
      });
      setGlobal(global);
    }
  }
});

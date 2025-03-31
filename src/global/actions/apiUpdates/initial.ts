import type { ApiChain, ApiLiquidStakingState } from '../../../api/types';

import { DEFAULT_STAKING_STATE, IS_CORE_WALLET, MTW_CARDS_COLLECTION } from '../../../config';
import { areDeepEqual } from '../../../util/areDeepEqual';
import { buildCollectionByKey } from '../../../util/iteratees';
import { callActionInNative } from '../../../util/multitab';
import { openUrl } from '../../../util/openUrl';
import { IS_DELEGATING_BOTTOM_SHEET, IS_IOS_APP } from '../../../util/windowEnvironment';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  addNft,
  createAccount,
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
        } else if (shouldUseNominators && stateById.nominators) {
          global = updateAccountStaking(global, accountId, {
            stakingId: stateById.nominators.id,
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

      if (!IS_CORE_WALLET) {
        update.nfts.forEach((nft) => {
          if (nft.collectionAddress === MTW_CARDS_COLLECTION) {
            global = updateAccountSettingsBackgroundNft(global, nft);
          }
        });
      }
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
      setGlobal(global);

      if (!IS_CORE_WALLET) {
        actions.checkCardNftOwnership();
        // If a user received an NFT card from the MyTonWallet collection, it is applied immediately
        if (nft.collectionAddress === MTW_CARDS_COLLECTION) {
          actions.setCardBackgroundNft({ nft });
          actions.installAccentColorFromNft({ nft });
        }
      }
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

      const shouldRestrictSwapsAndOnRamp = (IS_IOS_APP && isLimitedRegion) || IS_CORE_WALLET;
      global = updateRestrictions(global, {
        isLimitedRegion,
        isSwapDisabled: shouldRestrictSwapsAndOnRamp,
        isOnRampDisabled: shouldRestrictSwapsAndOnRamp,
        isNftBuyingDisabled: shouldRestrictSwapsAndOnRamp,
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
      void openUrl(update.url, { isExternal: update.isExternal, title: update.title, subtitle: update.subtitle });
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

    // Should be removed in future versions
    case 'migrateCoreApplication': {
      const {
        accountId,
        isTestnet,
        address,
        secondAddress,
        secondAccountId,
        isTonProxyEnabled,
        isTonMagicEnabled,
      } = update;

      global = updateSettings(global, { isTestnet });
      global = createAccount({ global, accountId, addressByChain: { ton: address } as Record<ApiChain, string> });
      global = createAccount({
        global,
        accountId: secondAccountId,
        addressByChain: { ton: secondAddress } as Record<ApiChain, string>,
        network: isTestnet ? 'mainnet' : 'testnet', // Second account should be created on opposite network
      });
      setGlobal(global);

      // Run the application only after the post-migration GlobalState has been applied
      requestAnimationFrame(() => {
        actions.tryAddNotificationAccount({ accountId });
        actions.switchAccount({ accountId, newNetwork: isTestnet ? 'testnet' : 'mainnet' });
        actions.afterSignIn();

        if (isTonMagicEnabled) {
          actions.toggleTonMagic({ isEnabled: true });
        }
        if (isTonProxyEnabled) {
          actions.toggleTonProxy({ isEnabled: true });
        }
      });
      break;
    }

    case 'updateAccountConfig': {
      const { accountConfig, accountId } = update;
      global = updateAccountState(global, accountId, { config: accountConfig });
      setGlobal(global);
    }
  }
});

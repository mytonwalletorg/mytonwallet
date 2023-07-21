import { buildCollectionByKey } from '../../../util/iteratees';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  addNft,
  removeNft,
  updateAccountState,
  updateBalance,
  updateNft,
  updatePoolState,
  updateTokens,
} from '../../reducers';

addActionHandler('apiUpdate', (global, actions, update) => {
  switch (update.type) {
    case 'updateBalance': {
      global = updateBalance(global, update.accountId, update.slug, update.balance);
      setGlobal(global);

      break;
    }

    case 'updateStakingState': {
      global = updateAccountState(global, update.accountId, {
        stakingBalance: update.stakingState.amount + update.stakingState.pendingDepositAmount,
        isUnstakeRequested: update.stakingState.isUnstakeRequested,
      }, true);
      setGlobal(global);
      break;
    }

    case 'updateBackendStakingState': {
      const { poolState } = update.backendStakingState;
      global = updatePoolState(global, poolState, true);
      setGlobal(global);

      break;
    }

    case 'updateTokens': {
      global = updateTokens(global, update.tokens, true);
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
  }

  actions.initTokensOrder();
});

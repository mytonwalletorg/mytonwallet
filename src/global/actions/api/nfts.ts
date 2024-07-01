import {
  BURN_ADDRESS, NOTCOIN_EXCHANGERS, NOTCOIN_VOUCHERS_ADDRESS, TONCOIN_SLUG,
} from '../../../config';
import { IS_DELEGATING_BOTTOM_SHEET } from '../../../util/windowEnvironment';
import { NFT_TRANSFER_TONCOIN_AMOUNT } from '../../../api/blockchains/ton/constants';
import { addActionHandler } from '../../index';
import { updateCurrentAccountState } from '../../reducers';
import { selectCurrentAccountState } from '../../selectors';

import { getIsPortrait } from '../../../hooks/useDeviceScreen';

const NBS_INIT_TIMEOUT = IS_DELEGATING_BOTTOM_SHEET ? 100 : 0;

addActionHandler('burnNfts', (global, actions, { nfts }) => {
  actions.startTransfer({
    isPortrait: getIsPortrait(),
    nfts,
  });

  const isNotcoinVouchers = nfts.some((n) => n.collectionAddress === NOTCOIN_VOUCHERS_ADDRESS);

  setTimeout(() => {
    actions.submitTransferInitial({
      tokenSlug: TONCOIN_SLUG,
      amount: NFT_TRANSFER_TONCOIN_AMOUNT,
      toAddress: isNotcoinVouchers ? NOTCOIN_EXCHANGERS[0] : BURN_ADDRESS,
      nftAddresses: nfts.map(({ address }) => address),
    });
  }, NBS_INIT_TIMEOUT);
});

addActionHandler('hideNft', (global, actions, { nftAddress }) => {
  let { blacklistedNftAddresses = [] } = selectCurrentAccountState(global) || {};

  blacklistedNftAddresses = blacklistedNftAddresses.filter((address) => address !== nftAddress);

  return updateCurrentAccountState(global, {
    blacklistedNftAddresses: [...blacklistedNftAddresses, nftAddress],
  });
});

addActionHandler('openHideNftModal', (global) => {
  return updateCurrentAccountState(global, {
    isHideNftModalOpened: true,
  });
});

addActionHandler('closeHideNftModal', (global) => {
  return updateCurrentAccountState(global, {
    isHideNftModalOpened: undefined,
  });
});

addActionHandler('openNftMenu', (global, actions, { nftAddress }) => {
  return updateCurrentAccountState(global, {
    nftWithOpenedMenuAddress: nftAddress,
  });
});

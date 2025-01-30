import {
  BURN_ADDRESS, NOTCOIN_EXCHANGERS, NOTCOIN_VOUCHERS_ADDRESS, TONCOIN,
} from '../../../config';
import { findDifference } from '../../../util/iteratees';
import { IS_DELEGATED_BOTTOM_SHEET, IS_DELEGATING_BOTTOM_SHEET } from '../../../util/windowEnvironment';
import { callApi } from '../../../api';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { updateAccountSettings, updateCurrentAccountState } from '../../reducers';
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
      tokenSlug: TONCOIN.slug,
      amount: 0n,
      toAddress: isNotcoinVouchers ? NOTCOIN_EXCHANGERS[0] : BURN_ADDRESS,
      nfts,
    });
  }, NBS_INIT_TIMEOUT);
});

addActionHandler('addNftsToBlacklist', (global, actions, { addresses: nftAddresses }) => {
  // Force hide NFT - remove it from whitelist and add to blacklist
  let { blacklistedNftAddresses = [], whitelistedNftAddresses = [] } = selectCurrentAccountState(global) || {};
  blacklistedNftAddresses = findDifference(blacklistedNftAddresses, nftAddresses);
  whitelistedNftAddresses = findDifference(whitelistedNftAddresses, nftAddresses);

  return updateCurrentAccountState(global, {
    blacklistedNftAddresses: [...blacklistedNftAddresses, ...nftAddresses],
    whitelistedNftAddresses,
  });
});

addActionHandler('addNftsToWhitelist', (global, actions, { addresses: nftAddresses }) => {
  // Force show NFT - remove it from blacklist and add to whitelist
  let { blacklistedNftAddresses = [], whitelistedNftAddresses = [] } = selectCurrentAccountState(global) || {};
  blacklistedNftAddresses = findDifference(blacklistedNftAddresses, nftAddresses);
  whitelistedNftAddresses = findDifference(whitelistedNftAddresses, nftAddresses);

  return updateCurrentAccountState(global, {
    blacklistedNftAddresses,
    whitelistedNftAddresses: [...whitelistedNftAddresses, ...nftAddresses],
  });
});

addActionHandler('removeNftSpecialStatus', (global, actions, { address: nftAddress }) => {
  // Stop forcing to show/hide NFT if it was in whitelist/blacklist
  let { blacklistedNftAddresses = [], whitelistedNftAddresses = [] } = selectCurrentAccountState(global) || {};

  blacklistedNftAddresses = blacklistedNftAddresses.filter((address) => address !== nftAddress);
  whitelistedNftAddresses = whitelistedNftAddresses.filter((address) => address !== nftAddress);

  return updateCurrentAccountState(global, {
    blacklistedNftAddresses,
    whitelistedNftAddresses,
  });
});

addActionHandler('openUnhideNftModal', (global, actions, { address, name }) => {
  return updateCurrentAccountState(global, {
    isUnhideNftModalOpen: true,
    selectedNftToUnhide: { address, name },
  });
});

addActionHandler('closeUnhideNftModal', (global) => {
  return updateCurrentAccountState(global, {
    isUnhideNftModalOpen: undefined,
    selectedNftToUnhide: undefined,
  });
});

addActionHandler('openHideNftModal', (global, actions, { addresses, isCollection }) => {
  return updateCurrentAccountState(global, {
    selectedNftsToHide: { addresses, isCollection },
  });
});

addActionHandler('closeHideNftModal', (global) => {
  return updateCurrentAccountState(global, {
    selectedNftsToHide: undefined,
  });
});

addActionHandler('checkCardNftOwnership', (global) => {
  if (IS_DELEGATED_BOTTOM_SHEET) return;

  const { byAccountId } = global.settings;

  Object.entries(byAccountId).forEach(async ([accountId, settings]) => {
    const cardBackgroundNftAddress = settings.cardBackgroundNft?.address;
    const accentColorNftAddress = settings.accentColorNft?.address;

    if (!cardBackgroundNftAddress && !accentColorNftAddress) return;

    const promises = [
      cardBackgroundNftAddress
        ? callApi('checkNftOwnership', accountId, cardBackgroundNftAddress)
        : undefined,
      accentColorNftAddress && accentColorNftAddress !== cardBackgroundNftAddress
        ? callApi('checkNftOwnership', accountId, accentColorNftAddress)
        : undefined,
    ];

    const [isCardBackgroundNftOwned, isAccentColorNftOwned] = await Promise.all(promises);

    let newGlobal = getGlobal();

    if (cardBackgroundNftAddress && isCardBackgroundNftOwned === false) {
      newGlobal = updateAccountSettings(newGlobal, accountId, {
        cardBackgroundNft: undefined,
      });
    }

    if (accentColorNftAddress && (
      (accentColorNftAddress === cardBackgroundNftAddress && isCardBackgroundNftOwned === false)
      || (accentColorNftAddress !== cardBackgroundNftAddress && isAccentColorNftOwned === false)
    )) {
      newGlobal = updateAccountSettings(newGlobal, accountId, {
        accentColorNft: undefined,
        accentColorIndex: undefined,
      });
    }

    setGlobal(newGlobal);
  });
});

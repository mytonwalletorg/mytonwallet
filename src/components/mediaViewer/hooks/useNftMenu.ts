import { useMemo } from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import type { ApiNft } from '../../../api/types';
import type { DropdownItem } from '../../ui/Dropdown';

import {
  BURN_ADDRESS,
  GETGEMS_BASE_MAINNET_URL,
  GETGEMS_BASE_TESTNET_URL,
  TON_DNS_COLLECTION,
  TON_TOKEN_SLUG,
  TONSCAN_BASE_MAINNET_URL,
  TONSCAN_BASE_TESTNET_URL,
} from '../../../config';
import { openUrl } from '../../../util/openUrl';
import { NFT_TRANSFER_TON_AMOUNT } from '../../../api/blockchains/ton/constants';

import { getIsPortrait } from '../../../hooks/useDeviceScreen';
import useLastCallback from '../../../hooks/useLastCallback';

const ON_SALE_ITEM: DropdownItem = {
  name: 'Cannot be sent',
  value: 'send',
  description: 'NFT is for sale',
  isDisabled: true,
};
const SEND_ITEM: DropdownItem = {
  name: 'Send',
  value: 'send',
};
const FRAGMENT_ITEM: DropdownItem = {
  name: 'Fragment',
  value: 'fragment',
  fontIcon: 'external',
};
const GETGEMS_ITEM: DropdownItem = {
  name: 'Getgems',
  value: 'getgems',
  fontIcon: 'external',
};
const TONSCAN_ITEM: DropdownItem = {
  name: 'TONScan',
  value: 'tonscan',
  fontIcon: 'external',
};
const TON_DNS_ITEM: DropdownItem = {
  name: 'Configure DNS',
  value: 'tondns',
  fontIcon: 'external',
};
const BURN_ITEM: DropdownItem = {
  name: 'Burn',
  value: 'burn',
};

export default function useNftMenu(nft?: ApiNft) {
  const { startTransfer, submitTransferInitial } = getActions();

  const handleMenuItemSelect = useLastCallback((value: string) => {
    const { isTestnet } = getGlobal().settings;
    switch (value) {
      case 'send': {
        startTransfer({
          isPortrait: getIsPortrait(),
          nft,
        });
        break;
      }

      case 'tonscan': {
        const tonscanBaseUrl = isTestnet ? TONSCAN_BASE_TESTNET_URL : TONSCAN_BASE_MAINNET_URL;
        const tonscanUrl = `${tonscanBaseUrl}nft/${nft!.address}`;

        openUrl(tonscanUrl);
        break;
      }

      case 'getgems': {
        const getgemsBaseUrl = isTestnet ? GETGEMS_BASE_TESTNET_URL : GETGEMS_BASE_MAINNET_URL;
        const getgemsUrl = `${getgemsBaseUrl}collection/${nft!.collectionAddress}/${nft!.address}`;

        openUrl(getgemsUrl);
        break;
      }

      case 'tondns': {
        const url = `https://dns.ton.org/#${(nft!.name || '').replace(/\.ton$/i, '')}`;

        openUrl(url);
        break;
      }

      case 'fragment': {
        let url: string;
        if (nft!.collectionName?.toLowerCase().includes('numbers')) {
          url = `https://fragment.com/number/${nft!.name?.replace(/[^0-9]/g, '')}`;
        } else {
          url = `https://fragment.com/username/${encodeURIComponent(nft!.name?.substring(1) || '')}`;
        }

        openUrl(url);
        break;
      }

      case 'burn': {
        startTransfer({
          isPortrait: getIsPortrait(),
          nft,
        });

        submitTransferInitial({
          tokenSlug: TON_TOKEN_SLUG,
          amount: NFT_TRANSFER_TON_AMOUNT,
          toAddress: BURN_ADDRESS,
          nftAddress: nft!.address,
        });

        break;
      }
    }
  });

  const menuItems = useMemo(() => {
    if (!nft) return [];

    return [
      nft.isOnSale ? ON_SALE_ITEM : SEND_ITEM,
      ...(nft.collectionAddress === TON_DNS_COLLECTION ? [TON_DNS_ITEM] : []),
      GETGEMS_ITEM,
      TONSCAN_ITEM,
      ...(nft.isOnFragment ? [FRAGMENT_ITEM] : []),
      BURN_ITEM,
    ];
  }, [nft]);

  return { menuItems, handleMenuItemSelect };
}

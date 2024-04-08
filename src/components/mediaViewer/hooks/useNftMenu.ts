import { useMemo } from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import type { ApiNft } from '../../../api/types';
import type { DropdownItem } from '../../ui/Dropdown';

import {
  GETGEMS_BASE_MAINNET_URL,
  GETGEMS_BASE_TESTNET_URL,
  TONSCAN_BASE_MAINNET_URL,
  TONSCAN_BASE_TESTNET_URL,
} from '../../../config';
import { openUrl } from '../../../util/openUrl';

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

export default function useNftMenu(nft?: ApiNft) {
  const handleMenuItemSelect = useLastCallback((value: string) => {
    const { isTestnet } = getGlobal().settings;
    switch (value) {
      case 'send': {
        getActions().startTransfer({
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
    }
  });

  const menuItems = useMemo(() => {
    if (!nft) return [];

    const result: DropdownItem[] = [];
    result.push(nft.isOnSale ? ON_SALE_ITEM : SEND_ITEM);
    result.push(GETGEMS_ITEM);
    result.push(TONSCAN_ITEM);
    if (nft.isOnFragment) {
      result.push(FRAGMENT_ITEM);
    }

    return result;
  }, [nft]);

  return { menuItems, handleMenuItemSelect };
}

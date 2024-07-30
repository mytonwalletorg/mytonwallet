import { useMemo } from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import type { ApiNft } from '../../../api/types';
import type { DropdownItem } from '../../ui/Dropdown';

import {
  GETGEMS_BASE_MAINNET_URL,
  GETGEMS_BASE_TESTNET_URL,
  TON_DNS_COLLECTION,
  TON_EXPLORER_NAME,
} from '../../../config';
import { openUrl } from '../../../util/openUrl';
import { getTonExplorerNftUrl } from '../../../util/url';

import { getIsPortrait } from '../../../hooks/useDeviceScreen';
import useLastCallback from '../../../hooks/useLastCallback';

const ON_SALE_ITEM: DropdownItem = {
  name: 'Cannot be sent',
  value: 'send',
  description: 'NFT is for sale',
  isDisabled: true,
};
const TON_DNS_ITEM: DropdownItem = {
  name: 'Configure DNS',
  value: 'tondns',
  fontIcon: 'external',
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
const TON_EXPLORER_ITEM: DropdownItem = {
  name: TON_EXPLORER_NAME,
  value: 'tonExplorer',
  fontIcon: 'external',
};
const COLLECTION_ITEM: DropdownItem = {
  name: 'Collection',
  value: 'collection',
};
const HIDE_ITEM: DropdownItem = {
  name: 'Hide',
  value: 'hide',
};
const NOT_SCAM: DropdownItem = {
  name: 'Not Scam',
  value: 'not_scam',
};
const UNHIDE: DropdownItem = {
  name: 'Unhide',
  value: 'unhide',
};
const BURN_ITEM: DropdownItem = {
  name: 'Burn',
  value: 'burn',
  isDangerous: true,
};
const SELECT_ITEM: DropdownItem = {
  name: 'Select',
  value: 'select',
  withSeparator: true,
};

export default function useNftMenu(nft?: ApiNft, isNftBlacklisted?: boolean, isNftWhitelisted?: boolean) {
  const {
    startTransfer,
    selectNfts,
    openNftCollection,
    burnNfts,
    addNftsToBlacklist,
    addNftsToWhitelist,
    closeMediaViewer,
    openUnhideNftModal,
  } = getActions();

  const handleMenuItemSelect = useLastCallback((value: string) => {
    const { isTestnet } = getGlobal().settings;
    switch (value) {
      case 'send': {
        startTransfer({
          isPortrait: getIsPortrait(),
          nfts: [nft!],
        });
        closeMediaViewer();

        break;
      }

      case 'tonExplorer': {
        const url = getTonExplorerNftUrl(nft!.address, isTestnet)!;

        openUrl(url);
        break;
      }

      case 'getgems': {
        const getgemsBaseUrl = isTestnet ? GETGEMS_BASE_TESTNET_URL : GETGEMS_BASE_MAINNET_URL;
        const getgemsUrl = nft!.collectionAddress
          ? `${getgemsBaseUrl}collection/${nft!.collectionAddress}/${nft!.address}`
          : `${getgemsBaseUrl}nft/${nft!.address}`;

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

      case 'collection': {
        openNftCollection({ address: nft!.collectionAddress! }, { forceOnHeavyAnimation: true });

        break;
      }

      case 'hide': {
        addNftsToBlacklist({ addresses: [nft!.address] });
        closeMediaViewer();

        break;
      }

      case 'not_scam': {
        openUnhideNftModal({ address: nft!.address, name: nft!.name });

        break;
      }

      case 'unhide': {
        addNftsToWhitelist({ addresses: [nft!.address] });
        closeMediaViewer();

        break;
      }

      case 'burn': {
        burnNfts({ nfts: [nft!] });
        closeMediaViewer();

        break;
      }

      case 'select': {
        selectNfts({ addresses: [nft!.address] });
        break;
      }
    }
  });

  const menuItems = useMemo(() => {
    if (!nft) return [];

    return [
      ...(nft.collectionAddress === TON_DNS_COLLECTION ? [TON_DNS_ITEM] : []),
      nft.isOnSale ? ON_SALE_ITEM : SEND_ITEM,
      ...(nft.isOnFragment ? [FRAGMENT_ITEM] : []),
      GETGEMS_ITEM,
      TON_EXPLORER_ITEM,
      ...(nft.collectionAddress ? [COLLECTION_ITEM] : []),
      ...((!nft.isScam && !isNftBlacklisted) || isNftWhitelisted ? [HIDE_ITEM] : []),
      ...(nft.isScam && !isNftWhitelisted ? [NOT_SCAM] : []),
      ...(!nft.isScam && isNftBlacklisted ? [UNHIDE] : []),
      ...(!nft.isOnSale ? [
        BURN_ITEM,
        SELECT_ITEM,
      ] : []),
    ];
  }, [nft, isNftBlacklisted, isNftWhitelisted]);

  return { menuItems, handleMenuItemSelect };
}

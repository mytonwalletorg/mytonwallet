import { useMemo } from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import type { ApiNft } from '../../../api/types';
import type { DropdownItem } from '../../ui/Dropdown';

import {
  GETGEMS_BASE_MAINNET_URL,
  GETGEMS_BASE_TESTNET_URL,
  MTW_CARDS_COLLECTION,
  TON_DNS_COLLECTION,
} from '../../../config';
import { openUrl } from '../../../util/openUrl';
import { getExplorerName, getExplorerNftUrl } from '../../../util/url';

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
  name: getExplorerName('ton'),
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
const INSTALL_CARD: DropdownItem = {
  name: 'Install Card',
  value: 'installCard',
};
const RESET_CARD: DropdownItem = {
  name: 'Reset Card',
  value: 'resetCard',
};
const INSTALL_ACCENT_COLOR: DropdownItem = {
  name: 'Apply Palette',
  value: 'installAccentColor',
};
const RESET_ACCENT_COLOR: DropdownItem = {
  name: 'Reset Palette',
  value: 'resetAccentColor',
};

export default function useNftMenu({
  nft,
  isNftBlacklisted,
  isNftWhitelisted,
  isNftInstalled,
  isNftAccentColorInstalled,
}: {
  nft?: ApiNft;
  isNftBlacklisted?: boolean;
  isNftWhitelisted?: boolean;
  isNftInstalled?: boolean;
  isNftAccentColorInstalled?: boolean;
}) {
  const {
    startTransfer,
    selectNfts,
    openNftCollection,
    burnNfts,
    addNftsToBlacklist,
    addNftsToWhitelist,
    closeMediaViewer,
    openUnhideNftModal,
    setCardBackgroundNft,
    clearCardBackgroundNft,
    installAccentColorFromNft,
    clearAccentColorFromNft,
  } = getActions();

  const handleMenuItemSelect = useLastCallback(async (value: string) => {
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
        const url = getExplorerNftUrl(nft!.address, isTestnet)!;

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

      case 'installCard': {
        setCardBackgroundNft({ nft: nft! });
        installAccentColorFromNft({ nft: nft! });
        break;
      }

      case 'resetCard': {
        clearCardBackgroundNft();
        clearAccentColorFromNft();
        break;
      }

      case 'installAccentColor': {
        installAccentColorFromNft({ nft: nft! });
        break;
      }

      case 'resetAccentColor': {
        clearAccentColorFromNft();
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

    const {
      collectionAddress, isOnSale, isOnFragment, isScam,
    } = nft;
    const isTonDns = nft.collectionAddress === TON_DNS_COLLECTION;
    const isCard = nft.collectionAddress === MTW_CARDS_COLLECTION;

    return [
      ...(isTonDns ? [TON_DNS_ITEM] : []),
      ...(isCard ? [!isNftInstalled ? INSTALL_CARD : RESET_CARD] : []),
      ...(isCard ? [!isNftAccentColorInstalled ? INSTALL_ACCENT_COLOR : RESET_ACCENT_COLOR] : []),
      {
        ...(isOnSale ? ON_SALE_ITEM : SEND_ITEM),
        ...(isCard && { withSeparator: true }),
      },
      ...(isOnFragment ? [FRAGMENT_ITEM] : []),
      GETGEMS_ITEM,
      TON_EXPLORER_ITEM,
      ...(collectionAddress ? [COLLECTION_ITEM] : []),
      ...((!isScam && !isNftBlacklisted) || isNftWhitelisted ? [HIDE_ITEM] : []),
      ...(isScam && !isNftWhitelisted ? [NOT_SCAM] : []),
      ...(!isScam && isNftBlacklisted ? [UNHIDE] : []),
      ...(!isOnSale ? [
        BURN_ITEM,
        SELECT_ITEM,
      ] : []),
    ];
  }, [nft, isNftInstalled, isNftAccentColorInstalled, isNftBlacklisted, isNftWhitelisted]);

  return { menuItems, handleMenuItemSelect };
}

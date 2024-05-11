import React, { memo, useEffect, useMemo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiNft } from '../../../../api/types';
import type { DropdownItem } from '../../../ui/Dropdown';

import {
  BURN_ADDRESS,
  GETGEMS_BASE_MAINNET_URL,
  GETGEMS_BASE_TESTNET_URL,
  TON_TOKEN_SLUG,
  TONSCAN_BASE_MAINNET_URL,
  TONSCAN_BASE_TESTNET_URL,
} from '../../../../config';
import { selectCurrentAccountState } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import captureEscKeyListener from '../../../../util/captureEscKeyListener';
import { openUrl } from '../../../../util/openUrl';
import { NFT_TRANSFER_TON_AMOUNT } from '../../../../api/blockchains/ton/constants';

import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import { getIsPortrait } from '../../../../hooks/useDeviceScreen';
import useFlag from '../../../../hooks/useFlag';
import useHistoryBack from '../../../../hooks/useHistoryBack';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import Button from '../../../ui/Button';
import DropdownMenu from '../../../ui/DropdownMenu';

import styles from './NftCollectionHeader.module.scss';

interface StateProps {
  isTestnet?: boolean;
  nfts?: Record<string, ApiNft>;
  currentCollectionAddress?: string;
}

const MENU_ITEMS: DropdownItem[] = [{
  name: 'Send All',
  value: 'sendAll',
}, {
  name: 'Getgems',
  value: 'getgems',
  fontIcon: 'external',
}, {
  name: 'TONScan',
  value: 'tonscan',
  fontIcon: 'external',
}, {
  name: 'Burn All',
  value: 'burnAll',
  isDangerous: true,
}, {
  name: 'Select All',
  value: 'selectAll',
  withSeparator: true,
}];

function NftCollectionHeader({
  isTestnet,
  nfts,
  currentCollectionAddress,
}: StateProps) {
  const {
    closeNftCollection,
    selectNfts,
    startTransfer,
    submitTransferInitial,
  } = getActions();

  const lang = useLang();
  const [isMenuOpen, openMenu, closeMenu] = useFlag();

  const nftFromCurrentCollection = useMemo(() => {
    if (!currentCollectionAddress || !nfts) {
      return undefined;
    }

    return Object.values(nfts).find((nft) => nft.collectionAddress === currentCollectionAddress);
  }, [currentCollectionAddress, nfts]);
  const amount = useMemo(() => {
    if (!currentCollectionAddress || !nfts) {
      return undefined;
    }

    return Object.values(nfts).reduce((acc, nft) => {
      return nft.collectionAddress === currentCollectionAddress ? acc + 1 : acc;
    }, 0);
  }, [currentCollectionAddress, nfts]);
  const renderedNft = useCurrentOrPrev(nftFromCurrentCollection, true);
  const renderedAmount = useCurrentOrPrev(amount, true);

  const isActive = Boolean(currentCollectionAddress);

  useHistoryBack({
    isActive,
    onBack: closeNftCollection,
  });

  useEffect(() => (isActive ? captureEscKeyListener(closeNftCollection) : undefined), [isActive]);

  const handleMenuItemClick = useLastCallback((value: string) => {
    switch (value) {
      case 'sendAll': {
        const collectionNfts = Object.values(nfts!).filter((nft) => {
          return nft.collectionAddress === currentCollectionAddress && !nft.isOnSale;
        });

        startTransfer({
          nfts: collectionNfts,
          isPortrait: getIsPortrait(),
        });
        break;
      }

      case 'getgems': {
        const getgemsBaseUrl = isTestnet ? GETGEMS_BASE_TESTNET_URL : GETGEMS_BASE_MAINNET_URL;
        openUrl(`${getgemsBaseUrl}collection/${renderedNft?.collectionAddress}`);
        break;
      }

      case 'tonscan': {
        const tonscanBaseUrl = isTestnet ? TONSCAN_BASE_TESTNET_URL : TONSCAN_BASE_MAINNET_URL;
        openUrl(`${tonscanBaseUrl}nft/${renderedNft?.collectionAddress}`);
        break;
      }

      case 'selectAll': {
        const addresses = Object.values(nfts || {})
          .filter((nft) => nft.collectionAddress === currentCollectionAddress && !nft.isOnSale)
          .map((nft) => nft.address);
        selectNfts({ addresses });
        break;
      }

      case 'burnAll': {
        const collectionNfts = Object.values(nfts!).filter((nft) => {
          return nft.collectionAddress === currentCollectionAddress && !nft.isOnSale;
        });

        startTransfer({
          isPortrait: getIsPortrait(),
          nfts: collectionNfts,
        });

        submitTransferInitial({
          tokenSlug: TON_TOKEN_SLUG,
          amount: NFT_TRANSFER_TON_AMOUNT,
          toAddress: BURN_ADDRESS,
          nftAddresses: collectionNfts.map(({ address }) => address),
        });
        break;
      }
    }
  });

  if (!renderedNft) {
    return undefined;
  }

  return (
    <div className={styles.root}>
      <Button className={styles.backButton} isSimple isText onClick={closeNftCollection}>
        <i className={buildClassName(styles.backIcon, 'icon-chevron-left')} aria-hidden />
        <span>{lang('Back')}</span>
      </Button>

      <div className={styles.content}>
        <div className={styles.title}>{renderedNft?.collectionName || lang('Unnamed Collection')}</div>
        <div className={styles.amount}>
          {renderedAmount! > 1 ? lang('%amount% NFTs', { amount: renderedAmount }) : lang('1 NFT')}
        </div>
      </div>

      <Button isSimple className={styles.menuButton} onClick={openMenu} ariaLabel={lang('Open Menu')}>
        <i className="icon-menu-dots" aria-hidden />
      </Button>
      <DropdownMenu
        isOpen={isMenuOpen}
        menuPositionHorizontal="right"
        buttonClassName={styles.menuItem}
        bubbleClassName={styles.menu}
        items={MENU_ITEMS}
        onSelect={handleMenuItemClick}
        onClose={closeMenu}
      />
    </div>
  );
}

export default memo(withGlobal((global): StateProps => {
  const {
    byAddress: nfts,
    currentCollectionAddress,
  } = selectCurrentAccountState(global)?.nfts || {};

  return {
    isTestnet: global.settings.isTestnet,
    nfts,
    currentCollectionAddress,
  };
})(NftCollectionHeader));

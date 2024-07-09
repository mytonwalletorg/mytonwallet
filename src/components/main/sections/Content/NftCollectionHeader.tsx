import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiNft } from '../../../../api/types';
import type { IAnchorPosition } from '../../../../global/types';
import type { DropdownItem } from '../../../ui/Dropdown';

import {
  GETGEMS_BASE_MAINNET_URL,
  GETGEMS_BASE_TESTNET_URL,
  TON_EXPLORER_NAME,
} from '../../../../config';
import { selectCurrentAccountState } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import captureEscKeyListener from '../../../../util/captureEscKeyListener';
import { openUrl } from '../../../../util/openUrl';
import { getTonExplorerNftCollectionUrl } from '../../../../util/url';

import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import { getIsPortrait } from '../../../../hooks/useDeviceScreen';
import useHistoryBack from '../../../../hooks/useHistoryBack';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useMenuPosition from '../../../../hooks/useMenuPosition';

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
  name: TON_EXPLORER_NAME,
  value: 'tonExplorer',
  fontIcon: 'external',
}, {
  name: 'Hide All',
  value: 'hideAll',
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
    burnNfts,
    openHideNftModal,
  } = getActions();

  const lang = useLang();
  const [menuPosition, setMenuPosition] = useState<IAnchorPosition>();
  const isMenuOpen = Boolean(menuPosition);
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLButtonElement>(null);

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

  const getTriggerElement = useLastCallback(() => ref.current);
  const getRootElement = useLastCallback(() => document.body);
  const getMenuElement = useLastCallback(() => document.querySelector('#portals .menu-bubble'));
  const getLayout = useLastCallback(() => ({ withPortal: true }));

  const {
    positionY, transformOriginX, transformOriginY, style: menuStyle,
  } = useMenuPosition(
    menuPosition,
    getTriggerElement,
    getRootElement,
    getMenuElement,
    getLayout,
  );

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

      case 'tonExplorer': {
        const url = getTonExplorerNftCollectionUrl(renderedNft?.collectionAddress, isTestnet);
        if (url) {
          openUrl(url);
        }
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
        burnNfts({ nfts: collectionNfts });

        break;
      }

      case 'hideAll': {
        const collectionNfts = Object.values(nfts!)
          .filter((nft) => {
            return nft.collectionAddress === currentCollectionAddress;
          })
          .map((nft) => nft.address);
        openHideNftModal({ addresses: collectionNfts, isCollection: true });
      }
    }
  });
  const handleMenuOpen = useLastCallback(() => {
    const { right: x, bottom: y } = ref.current!.getBoundingClientRect();
    setMenuPosition({ x, y });
  });
  const handleMenuClose = useLastCallback(() => {
    setMenuPosition(undefined);
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

      <Button isSimple ref={ref} className={styles.menuButton} onClick={handleMenuOpen} ariaLabel={lang('Open Menu')}>
        <i className="icon-menu-dots" aria-hidden />
      </Button>
      <DropdownMenu
        isOpen={isMenuOpen}
        withPortal
        shouldTranslateOptions
        menuPositionHorizontal="right"
        menuPosition={positionY}
        menuStyle={menuStyle}
        transformOriginX={transformOriginX}
        transformOriginY={transformOriginY}
        buttonClassName={styles.menuItem}
        bubbleClassName={styles.menu}
        items={MENU_ITEMS}
        onSelect={handleMenuItemClick}
        onClose={handleMenuClose}
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

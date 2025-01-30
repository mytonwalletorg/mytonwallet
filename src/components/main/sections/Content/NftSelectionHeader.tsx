import React, {
  memo, useEffect, useRef, useState,
} from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiNft } from '../../../../api/types';
import { type IAnchorPosition } from '../../../../global/types';

import { selectCurrentAccountState } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import captureEscKeyListener from '../../../../util/captureEscKeyListener';

import { getIsPortrait } from '../../../../hooks/useDeviceScreen';
import useHistoryBack from '../../../../hooks/useHistoryBack';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useMenuPosition from '../../../../hooks/useMenuPosition';

import Button from '../../../ui/Button';
import { type DropdownItem } from '../../../ui/Dropdown';
import DropdownMenu from '../../../ui/DropdownMenu';

import styles from './NftCollectionHeader.module.scss';

interface StateProps {
  byAddress?: Record<string, ApiNft>;
  selectedAddresses?: string[];
  currentCollectionAddress?: string;
}

const MENU_ITEMS: DropdownItem[] = [{
  name: 'Send',
  value: 'send',
}, {
  name: 'Hide',
  value: 'hide',
}, {
  name: 'Burn',
  value: 'burn',
  isDangerous: true,
}, {
  name: 'Select All',
  value: 'select-all',
  withSeparator: true,
}];

function NftSelectionHeader({ selectedAddresses, byAddress, currentCollectionAddress }: StateProps) {
  const {
    selectAllNfts, clearNftsSelection, startTransfer, burnNfts, openHideNftModal,
  } = getActions();

  const lang = useLang();
  const amount = selectedAddresses?.length ?? 1;
  const isActive = Boolean(selectedAddresses?.length);

  useHistoryBack({
    isActive,
    onBack: clearNftsSelection,
  });

  useEffect(() => (isActive ? captureEscKeyListener(clearNftsSelection) : undefined), [isActive]);

  const handleSendClick = useLastCallback(() => {
    const nfts = selectedAddresses!.map((address) => byAddress![address]) ?? [];

    clearNftsSelection();

    startTransfer({
      isPortrait: getIsPortrait(),
      nfts,
    });
  });

  const handleBurnClick = useLastCallback(() => {
    const nfts = selectedAddresses!.map((address) => byAddress![address]) ?? [];

    clearNftsSelection();

    burnNfts({ nfts });
  });

  const handleHideClick = useLastCallback(() => {
    clearNftsSelection();

    openHideNftModal({ addresses: selectedAddresses!, isCollection: false });
  });

  const [menuPosition, setMenuPosition] = useState<IAnchorPosition>();
  const isMenuOpen = Boolean(menuPosition);
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLButtonElement>(null);
  const handleMenuOpen = useLastCallback(() => {
    const { right: x, bottom: y } = ref.current!.getBoundingClientRect();
    setMenuPosition({ x, y });
  });
  const handleMenuClose = useLastCallback(() => {
    setMenuPosition(undefined);
  });
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
      case 'send': {
        handleSendClick();
        break;
      }
      case 'hide': {
        handleHideClick();
        break;
      }
      case 'burn': {
        handleBurnClick();
        break;
      }
      case 'select-all': {
        selectAllNfts({ collectionAddress: currentCollectionAddress });
        break;
      }
    }
  });

  return (
    <div className={styles.root}>
      <Button className={styles.backButton} isSimple isText onClick={clearNftsSelection}>
        <i className={buildClassName(styles.backIcon, 'icon-chevron-left')} aria-hidden />
        <span>{lang('Back')}</span>
      </Button>
      <div className={styles.content}>
        <div className={styles.title}>
          {amount > 1 ? lang('%amount% NFTs Selected', { amount }) : lang('1 NFT Selected')}
        </div>
      </div>
      <div>
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
    </div>
  );
}

export default memo(withGlobal((global): StateProps => {
  const {
    selectedAddresses, byAddress, currentCollectionAddress,
  } = selectCurrentAccountState(global)?.nfts || {};

  return { selectedAddresses, byAddress, currentCollectionAddress };
})(NftSelectionHeader));

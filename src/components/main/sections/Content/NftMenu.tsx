import React, { memo } from '../../../../lib/teact/teact';

import type { ApiNft } from '../../../../api/types';

import buildClassName from '../../../../util/buildClassName';
import stopEvent from '../../../../util/stopEvent';

import useNftMenu from '../../../mediaViewer/hooks/useNftMenu';

import DropdownMenu from '../../../ui/DropdownMenu';

import styles from './NftMenu.module.scss';

interface OwnProps {
  nft: ApiNft;
  isOpen: boolean;
  onOpen: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
}

function NftMenu({
  nft, isOpen, onOpen, onClose,
}: OwnProps) {
  const { menuItems, handleMenuItemSelect } = useNftMenu(nft);

  const handleButtonClick = (e: React.MouseEvent) => {
    stopEvent(e);

    if (isOpen) {
      onClose();
    } else {
      onOpen();
    }
  };

  return (
    <>
      <button type="button" className={styles.button} onClick={handleButtonClick}>
        <i className={buildClassName(styles.icon, 'icon-menu-dots')} aria-hidden />
      </button>
      <DropdownMenu
        isOpen={isOpen}
        items={menuItems}
        shouldTranslateOptions
        menuPositionHorizontal="right"
        className={styles.menu}
        buttonClassName={styles.item}
        bubbleClassName={styles.menuBubble}
        onClose={onClose}
        onSelect={handleMenuItemSelect}
      />
    </>
  );
}

export default memo(NftMenu);

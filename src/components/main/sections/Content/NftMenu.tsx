import React, { memo, useRef } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiNft } from '../../../../api/types';
import type { IAnchorPosition } from '../../../../global/types';

import buildClassName from '../../../../util/buildClassName';
import stopEvent from '../../../../util/stopEvent';

import useLastCallback from '../../../../hooks/useLastCallback';
import useMenuPosition from '../../../../hooks/useMenuPosition';
import useNftMenu from '../../../mediaViewer/hooks/useNftMenu';

import DropdownMenu from '../../../ui/DropdownMenu';

import styles from './NftMenu.module.scss';

interface OwnProps {
  nft: ApiNft;
  menuPosition?: IAnchorPosition;
  onOpen: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
}

function NftMenu({
  nft, menuPosition, onOpen, onClose,
}: OwnProps) {
  const { menuItems, handleMenuItemSelect } = useNftMenu(nft);
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLButtonElement>(null);
  const isOpen = Boolean(menuPosition);

  const getTriggerElement = useLastCallback(() => ref.current);
  const getRootElement = useLastCallback(() => document.body);
  const getMenuElement = useLastCallback(() => document.querySelector('#portals .menu-bubble'));
  const getLayout = useLastCallback(() => ({ withPortal: true }));
  const { openNftMenu } = getActions();

  const {
    positionY, transformOriginX, transformOriginY, style: menuStyle,
  } = useMenuPosition(
    menuPosition,
    getTriggerElement,
    getRootElement,
    getMenuElement,
    getLayout,
  );

  const handleButtonClick = (e: React.MouseEvent) => {
    stopEvent(e);

    if (isOpen) {
      onClose();
    } else {
      openNftMenu({ nftAddress: nft!.address });
      onOpen();
    }
  };

  return (
    <>
      <button ref={ref} type="button" className={styles.button} onClick={handleButtonClick}>
        <i className={buildClassName(styles.icon, 'icon-menu-dots')} aria-hidden />
      </button>
      <DropdownMenu
        isOpen={isOpen}
        withPortal
        menuPositionHorizontal="right"
        menuPosition={positionY}
        menuStyle={menuStyle}
        transformOriginX={transformOriginX}
        transformOriginY={transformOriginY}
        items={menuItems}
        shouldTranslateOptions
        className={styles.menu}
        buttonClassName={styles.item}
        onClose={onClose}
        onSelect={handleMenuItemSelect}
      />
    </>
  );
}

export default memo(NftMenu);

import React, { memo, useMemo, useRef } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import type { ApiNft } from '../../../../api/types';
import type { IAnchorPosition } from '../../../../global/types';

import { selectCurrentAccountState } from '../../../../global/selectors';
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

interface StateProps {
  blacklistedNftAddresses?: string[];
  whitelistedNftAddresses?: string[];
}

function NftMenu({
  nft, menuPosition, onOpen, onClose, blacklistedNftAddresses, whitelistedNftAddresses,
}: OwnProps & StateProps) {
  const isNftBlackListed = useMemo(() => {
    return blacklistedNftAddresses?.includes(nft.address);
  }, [nft, blacklistedNftAddresses]);
  const isNftWhiteListed = useMemo(() => {
    return whitelistedNftAddresses?.includes(nft.address);
  }, [nft, whitelistedNftAddresses]);

  const { menuItems, handleMenuItemSelect } = useNftMenu(nft, isNftBlackListed, isNftWhiteListed);
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLButtonElement>(null);
  const isOpen = Boolean(menuPosition);

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
        shouldCleanup
        onClose={onClose}
        onSelect={handleMenuItemSelect}
      />
    </>
  );
}

export default memo(withGlobal((global): StateProps => {
  const accountState = selectCurrentAccountState(global) || {};
  const { blacklistedNftAddresses, whitelistedNftAddresses } = accountState;
  return {
    blacklistedNftAddresses,
    whitelistedNftAddresses,
  };
})(NftMenu));

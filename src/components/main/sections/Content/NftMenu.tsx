import React, { memo, useMemo, useRef } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import type { ApiNft } from '../../../../api/types';
import type { IAnchorPosition } from '../../../../global/types';

import { selectCurrentAccountSettings, selectCurrentAccountState } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import stopEvent from '../../../../util/stopEvent';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useMenuPosition from '../../../../hooks/useMenuPosition';
import { usePrevDuringAnimationSimple } from '../../../../hooks/usePrevDuringAnimationSimple';
import useNftMenu from '../../../mediaViewer/hooks/useNftMenu';

import DropdownMenu from '../../../ui/DropdownMenu';
import { ANIMATION_DURATION } from '../../../ui/Menu';

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
  cardBackgroundNft?: ApiNft;
  accentColorNft?: ApiNft;
}

function NftMenu({
  nft,
  menuPosition,
  onOpen,
  onClose,
  blacklistedNftAddresses,
  whitelistedNftAddresses,
  cardBackgroundNft,
  accentColorNft,
}: OwnProps & StateProps) {
  const isNftBlacklisted = useMemo(() => {
    return blacklistedNftAddresses?.includes(nft.address);
  }, [nft, blacklistedNftAddresses]);
  const isNftWhitelisted = useMemo(() => {
    return whitelistedNftAddresses?.includes(nft.address);
  }, [nft, whitelistedNftAddresses]);
  const isNftInstalled = usePrevDuringAnimationSimple(
    nft && nft.address === cardBackgroundNft?.address, ANIMATION_DURATION,
  );
  const isNftAccentColorInstalled = usePrevDuringAnimationSimple(
    nft && nft.address === accentColorNft?.address, ANIMATION_DURATION,
  );

  const { menuItems, handleMenuItemSelect } = useNftMenu({
    nft, isNftBlacklisted, isNftWhitelisted, isNftInstalled, isNftAccentColorInstalled,
  });
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLButtonElement>(null);
  const isOpen = Boolean(menuPosition);

  const getTriggerElement = useLastCallback(() => ref.current);
  const getRootElement = useLastCallback(() => document.body);
  const getMenuElement = useLastCallback(() => document.querySelector('#portals .menu-bubble'));
  const getLayout = useLastCallback(() => ({ withPortal: true }));

  const lang = useLang();

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
      <button
        ref={ref}
        type="button"
        className={styles.button}
        aria-label={lang('NFT Menu')}
        onClick={handleButtonClick}
      >
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

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const { blacklistedNftAddresses, whitelistedNftAddresses } = selectCurrentAccountState(global) || {};
  const { cardBackgroundNft, accentColorNft } = selectCurrentAccountSettings(global) || {};

  return {
    blacklistedNftAddresses, whitelistedNftAddresses, cardBackgroundNft, accentColorNft,
  };
})(NftMenu));

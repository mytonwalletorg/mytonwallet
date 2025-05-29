import React, { memo, useMemo, useRef } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import type { ApiNft } from '../../../../api/types';
import type { IAnchorPosition } from '../../../../global/types';

import {
  selectCurrentAccountSettings,
  selectCurrentAccountState,
  selectIsCurrentAccountViewMode,
  selectTonDnsLinkedAddress,
} from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { stopEvent } from '../../../../util/domEvents';
import { vibrate } from '../../../../util/haptics';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import { usePrevDuringAnimationSimple } from '../../../../hooks/usePrevDuringAnimationSimple';
import useNftMenu from '../../../mediaViewer/hooks/useNftMenu';

import DropdownMenu from '../../../ui/DropdownMenu';
import { ANIMATION_DURATION } from '../../../ui/Menu';

import styles from './NftMenu.module.scss';

interface OwnProps {
  nft: ApiNft;
  dnsExpireInDays?: number;
  menuAnchor?: IAnchorPosition;
  onOpen: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
}

interface StateProps {
  isViewMode: boolean;
  blacklistedNftAddresses?: string[];
  whitelistedNftAddresses?: string[];
  cardBackgroundNft?: ApiNft;
  accentColorNft?: ApiNft;
  linkedAddress?: string;
}

function NftMenu({
  isViewMode,
  nft,
  dnsExpireInDays,
  linkedAddress,
  menuAnchor,
  blacklistedNftAddresses,
  whitelistedNftAddresses,
  cardBackgroundNft,
  accentColorNft,
  onOpen,
  onClose,
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
    nft,
    isViewMode,
    dnsExpireInDays,
    linkedAddress,
    isNftBlacklisted,
    isNftWhitelisted,
    isNftInstalled,
    isNftAccentColorInstalled,
  });
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLButtonElement>(null);
  // eslint-disable-next-line no-null/no-null
  const menuRef = useRef<HTMLDivElement>(null);
  const isOpen = Boolean(menuAnchor);

  const getTriggerElement = useLastCallback(() => ref.current);
  const getRootElement = useLastCallback(() => document.body);
  const getMenuElement = useLastCallback(() => menuRef.current);
  const getLayout = useLastCallback(() => ({ withPortal: true }));

  const lang = useLang();

  const handleButtonClick = (e: React.MouseEvent) => {
    stopEvent(e);

    if (isOpen) {
      onClose();
    } else {
      void vibrate();
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
        ref={menuRef}
        withPortal
        menuAnchor={menuAnchor}
        menuPositionX="right"
        getTriggerElement={getTriggerElement}
        getRootElement={getRootElement}
        getMenuElement={getMenuElement}
        getLayout={getLayout}
        items={menuItems}
        shouldTranslateOptions
        className={styles.menu}
        bubbleClassName={styles.menuBubble}
        buttonClassName={styles.item}
        shouldCleanup
        onClose={onClose}
        onSelect={handleMenuItemSelect}
      />
    </>
  );
}

export default memo(withGlobal<OwnProps>((global, { nft }): StateProps => {
  const { blacklistedNftAddresses, whitelistedNftAddresses } = selectCurrentAccountState(global) || {};
  const { cardBackgroundNft, accentColorNft } = selectCurrentAccountSettings(global) || {};
  const linkedAddress = selectTonDnsLinkedAddress(global, nft);

  return {
    blacklistedNftAddresses,
    whitelistedNftAddresses,
    cardBackgroundNft,
    accentColorNft,
    isViewMode: selectIsCurrentAccountViewMode(global),
    linkedAddress,
  };
})(NftMenu));

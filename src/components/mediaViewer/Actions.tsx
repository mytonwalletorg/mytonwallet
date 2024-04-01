import React, { memo, useMemo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import { MediaType } from '../../global/types';

import { TONSCAN_BASE_MAINNET_URL, TONSCAN_BASE_TESTNET_URL } from '../../config';
import { selectCurrentAccountState } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';

import { useDeviceScreen } from '../../hooks/useDeviceScreen';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import DropdownMenu from '../ui/DropdownMenu';

import styles from './MediaViewer.module.scss';

type OwnProps = {
  onClose: NoneToVoidFunction;
  // eslint-disable-next-line react/no-unused-prop-types
  mediaId?: string;
};

type StateProps = {
  tonscanUrl?: string;
};

function Actions({ onClose, tonscanUrl }: StateProps & OwnProps) {
  const lang = useLang();
  const { isPortrait } = useDeviceScreen();
  const [isMenuOpen, openMenu, closeMenu] = useFlag();

  const handleSelect = useLastCallback((value: string) => {
    switch (value) {
      case 'tonscan':
        window.open(tonscanUrl, '_blank', 'noopener');
    }
  });

  const dropdownMenuItems = useMemo(() => [
    { value: 'tonscan', fontIcon: 'tonscan', name: 'Open TON Explorer' },
  ], []);

  if (isPortrait) {
    return (
      <div>
        <button
          type="button"
          className={buildClassName(styles.actionButton, styles.menuButton, isMenuOpen && styles.menuButton_active)}
          onClick={openMenu}
          aria-label={lang('More actions')}
        >
          <i className="icon icon-more" />
        </button>
        <DropdownMenu
          menuPosition="top"
          menuPositionHorizontal="right"
          shouldTranslateOptions
          isOpen={isMenuOpen}
          onClose={closeMenu}
          onSelect={handleSelect}
          items={dropdownMenuItems}
        />
      </div>
    );
  }

  return (
    <div className={styles.actions}>
      <a
        className={buildClassName(styles.actionButton)}
        aria-label={lang('Open TON Explorer')}
        href={tonscanUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        <i className={buildClassName('icon-tonscan', styles.actionIcon)} aria-hidden />
      </a>
      <button
        type="button"
        className={buildClassName(styles.actionButton, styles.hideOnMobile)}
        aria-label={lang('Close')}
        onClick={onClose}
      >
        <i className={buildClassName('icon-windows-close', styles.actionIcon)} aria-hidden />
      </button>
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global, { mediaId }): StateProps => {
  if (!mediaId) return {};

  const { mediaType = MediaType.Nft } = global.mediaViewer || {};
  const isTestnet = global.settings.isTestnet;

  const tonscanBaseUrl = isTestnet ? TONSCAN_BASE_TESTNET_URL : TONSCAN_BASE_MAINNET_URL;

  if (mediaType === MediaType.Nft) {
    const { byAddress } = selectCurrentAccountState(global)?.nfts || {};
    const nft = byAddress?.[mediaId];
    if (!nft) return {};
    return {
      tonscanUrl: `${tonscanBaseUrl}nft/${nft.address}`,
    };
  }

  return {};
})(Actions));

import React, { memo, useMemo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { ApiNft } from '../../api/types';
import { MediaType } from '../../global/types';

import { selectCurrentAccountState } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useNftMenu from './hooks/useNftMenu';

import DropdownMenu from '../ui/DropdownMenu';

import styles from './MediaViewer.module.scss';

type OwnProps = {
  // eslint-disable-next-line react/no-unused-prop-types
  mediaId?: string;
  onClose: NoneToVoidFunction;
};

type StateProps = {
  nft?: ApiNft;
  blacklistedNftAddresses?: string[];
  whitelistedNftAddresses?: string[];
};

function Actions({
  onClose, nft, blacklistedNftAddresses, whitelistedNftAddresses,
}: StateProps & OwnProps) {
  const lang = useLang();
  const [isMenuOpen, openMenu, closeMenu] = useFlag();

  const isNftBlackListed = useMemo(() => {
    return blacklistedNftAddresses?.includes(nft!.address);
  }, [nft, blacklistedNftAddresses]);
  const isNftWhiteListed = useMemo(() => {
    return whitelistedNftAddresses?.includes(nft!.address);
  }, [nft, whitelistedNftAddresses]);

  const { menuItems, handleMenuItemSelect } = useNftMenu(nft, isNftBlackListed, isNftWhiteListed);

  const handleSelect = useLastCallback((value: string) => {
    if (value === 'send') {
      onClose();
    }

    handleMenuItemSelect(value);
  });

  return (
    <div className={styles.actions}>
      <button
        type="button"
        aria-label={lang('More actions')}
        className={buildClassName(styles.actionButton, styles.menuButton, isMenuOpen && styles.menuButton_active)}
        onClick={openMenu}
      >
        <i className="icon icon-more" aria-hidden />
      </button>
      <DropdownMenu
        isOpen={isMenuOpen}
        items={menuItems}
        menuPosition="top"
        menuPositionHorizontal="right"
        shouldTranslateOptions
        onClose={closeMenu}
        className="component-theme-dark"
        buttonClassName={styles.menuItem}
        onSelect={handleSelect}
      />

      <button
        type="button"
        aria-label={lang('Close')}
        className={styles.actionButton}
        onClick={onClose}
      >
        <i className={buildClassName('icon-windows-close', styles.actionIcon)} aria-hidden />
      </button>
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global, { mediaId }): StateProps => {
  const { mediaType = MediaType.Nft } = global.mediaViewer || {};

  if (!mediaId || mediaType !== MediaType.Nft) return {};

  const { byAddress } = selectCurrentAccountState(global)?.nfts || {};
  const nft = byAddress?.[mediaId];
  if (!nft) return {};

  const { blacklistedNftAddresses, whitelistedNftAddresses } = selectCurrentAccountState(global) || {};

  return {
    nft, blacklistedNftAddresses, whitelistedNftAddresses,
  };
})(Actions));

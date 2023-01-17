import type { FocusEvent } from 'react';
import React, { memo, useCallback } from '../../../../lib/teact/teact';
import { withGlobal, getActions } from '../../../../global';

import { PROXY_HOSTS, TELEGRAM_WEB_URL } from '../../../../config';
import { IS_EXTENSION } from '../../../../util/environment';
import buildClassName from '../../../../util/buildClassName';
import useFlag from '../../../../hooks/useFlag';
import useShowTransition from '../../../../hooks/useShowTransition';
import useLang from '../../../../hooks/useLang';

import AboutModal from '../../../common/AboutModal';
import Button from '../../../ui/Button';
import SearchBar from '../../../ui/SearchBar';
import Menu from '../../../ui/Menu';
import MenuItem from '../../../ui/MenuItem';
import Switcher from '../../../ui/Switcher';

import LogOutModal from '../../modals/LogOutModal';

import styles from './Header.module.scss';

type OwnProps = {
  onBackupWalletOpen: NoneToVoidFunction;
};

type StateProps = {
  isTonProxyEnabled?: boolean;
  isTonMagicEnabled?: boolean;
};

function Header({
  onBackupWalletOpen,
  isTonProxyEnabled,
  isTonMagicEnabled,
}: OwnProps & StateProps) {
  const {
    toggleTonProxy,
    toggleTonMagic,
    openSettingsModal,
  } = getActions();

  const lang = useLang();
  const [isMenuOpened, openMenu, closeMenu] = useFlag(false);
  const [isAboutOpened, openAbout, closeAbout] = useFlag(false);
  const [isLogOutModalOpened, openLogOutModal, closeLogOutModal] = useFlag(false);
  const {
    transitionClassNames: telegramLinkClassNames,
    shouldRender: isTelegramLinkRendered,
  } = useShowTransition(IS_EXTENSION && isTonMagicEnabled);

  // Remove when implemented
  const handleFocus = useCallback((e: FocusEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.target.blur();
  }, []);

  const handleToggleMenuClick = useCallback(() => {
    if (isMenuOpened) {
      closeMenu();
    } else {
      openMenu();
    }
  }, [closeMenu, isMenuOpened, openMenu]);

  const handleTonProxyToggle = useCallback(() => {
    toggleTonProxy({ isEnabled: !isTonProxyEnabled });
  }, [isTonProxyEnabled, toggleTonProxy]);

  const handleTonMagicToggle = useCallback(() => {
    toggleTonMagic({ isEnabled: !isTonMagicEnabled });
  }, [isTonMagicEnabled, toggleTonMagic]);

  const handleOpenBackupWallet = useCallback(() => {
    closeMenu();
    onBackupWalletOpen();
  }, [closeMenu, onBackupWalletOpen]);

  const handleSettingsModalOpen = useCallback(() => {
    closeMenu();
    openSettingsModal();
  }, [closeMenu, openSettingsModal]);

  const handleOpenAbout = useCallback(() => {
    closeMenu();
    openAbout();
  }, [closeMenu, openAbout]);

  const handleOpenConfirmation = useCallback(() => {
    closeMenu();
    openLogOutModal();
  }, [closeMenu, openLogOutModal]);

  return (
    <div className={styles.wrapper}>
      <i className={buildClassName(styles.icon, 'icon-search')} aria-hidden />
      <SearchBar
        className={buildClassName(styles.search, 'not-implemented')}
        onFocus={handleFocus}
      />
      <Button
        className={styles.button}
        isSmall
        kind="transparent"
        ariaLabel={lang('Main menu')}
        onClick={handleToggleMenuClick}
      >
        <i className="icon-menu" aria-hidden />
      </Button>
      <Menu bubbleClassName={styles.menu} isOpen={isMenuOpened} onClose={closeMenu} positionX="right">
        {IS_EXTENSION && PROXY_HOSTS && (
          <MenuItem onClick={handleTonProxyToggle}>
            {lang('TON Proxy')}
            <Switcher
              className={styles.menuSwitcher}
              label={lang('Toggle TON Proxy')}
              checked={isTonProxyEnabled}
            />
          </MenuItem>
        )}
        {IS_EXTENSION && (
          <MenuItem onClick={handleTonMagicToggle} isSeparator={!isTelegramLinkRendered}>
            {lang('TON Magic')}
            <Switcher
              className={styles.menuSwitcher}
              label={lang('Toggle TON Magic')}
              checked={isTonMagicEnabled}
            />
          </MenuItem>
        )}
        {isTelegramLinkRendered && (
          <MenuItem isSeparator href={TELEGRAM_WEB_URL} className={telegramLinkClassNames}>
            {lang('Open Telegram Web')}
          </MenuItem>
        )}
        <MenuItem onClick={handleOpenBackupWallet}>{lang('Back Up Secret Words')}</MenuItem>
        <MenuItem onClick={handleSettingsModalOpen}>{lang('Settings')}</MenuItem>
        <MenuItem onClick={handleOpenAbout}>{lang('About')}</MenuItem>
        <MenuItem isDestructive onClick={handleOpenConfirmation}>{lang('Exit')}</MenuItem>
      </Menu>

      {(isLogOutModalOpened || isMenuOpened) && <LogOutModal isOpen={isLogOutModalOpened} onClose={closeLogOutModal} />}
      <AboutModal isOpen={isAboutOpened} onClose={closeAbout} />
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  return {
    isTonProxyEnabled: global.settings.isTonProxyEnabled,
    isTonMagicEnabled: global.settings.isTonMagicEnabled,
  };
})(Header));

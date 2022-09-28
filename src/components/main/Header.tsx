import type { FocusEvent } from 'react';
import React, { memo, useCallback } from '../../lib/teact/teact';
import { withGlobal, getActions } from '../../global';

import {
  APP_NAME, APP_VERSION, MNEMONIC_COUNT, PROXY_HOSTS, TELEGRAM_WEB_URL,
} from '../../config';
import { IS_EXTENSION } from '../../util/environment';
import buildClassName from '../../util/buildClassName';
import useFlag from '../../hooks/useFlag';

import Button from '../ui/Button';
import SearchBar from '../ui/SearchBar';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';
import Modal from '../ui/Modal';
import Switcher from '../ui/Switcher';

import styles from './Header.module.scss';
import modalStyles from '../ui/Modal.module.scss';
import logoSrc from '../../assets/logo.svg';
import useShowTransition from '../../hooks/useShowTransition';

type OwnProps = {
  onOpenBackupWallet: () => void;
};

type StateProps = {
  areTinyTransfersHidden?: boolean;
  isTonProxyEnabled?: boolean;
  isTonMagicEnabled?: boolean;
};

function Header({
  onOpenBackupWallet,
  areTinyTransfersHidden,
  isTonProxyEnabled,
  isTonMagicEnabled,
}: OwnProps & StateProps) {
  const {
    toggleTinyTransfersHidden,
    toggleTonProxy,
    toggleTonMagic,
    signOut,
  } = getActions();
  const [isMenuOpened, openMenu, closeMenu] = useFlag(false);
  const [isAboutOpened, openAbout, closeAbout] = useFlag(false);
  const [isExitConfirmOpened, openExitConfirm, closeExitConfirm] = useFlag(false);
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

  const handleOpenAbout = useCallback(() => {
    closeMenu();
    openAbout();
  }, [closeMenu, openAbout]);

  const handleTinyTransfersHiddenToggle = useCallback(() => {
    toggleTinyTransfersHidden({ isEnabled: !areTinyTransfersHidden });
  }, [areTinyTransfersHidden, toggleTinyTransfersHidden]);

  const handleOpenBackupWallet = useCallback(() => {
    closeMenu();
    onOpenBackupWallet();
  }, [closeMenu, onOpenBackupWallet]);

  const handleTonProxyToggle = useCallback(() => {
    toggleTonProxy({ isEnabled: !isTonProxyEnabled });
  }, [isTonProxyEnabled, toggleTonProxy]);

  const handleTonMagicToggle = useCallback(() => {
    toggleTonMagic({ isEnabled: !isTonMagicEnabled });
  }, [isTonMagicEnabled, toggleTonMagic]);

  const handleOpenConfirmation = useCallback(() => {
    closeMenu();
    openExitConfirm();
  }, [closeMenu, openExitConfirm]);

  const handleLogOut = useCallback(() => {
    closeExitConfirm();
    signOut();
  }, [closeExitConfirm, signOut]);

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
        ariaLabel="Main menu"
        onClick={handleToggleMenuClick}
      >
        <i className="icon-menu" aria-hidden />
      </Button>
      <Menu bubbleClassName={styles.menu} isOpen={isMenuOpened} onClose={closeMenu} positionX="right">
        {IS_EXTENSION && <MenuItem onClick={handleOpenAbout}>About</MenuItem>}
        {IS_EXTENSION && PROXY_HOSTS && (
          <MenuItem onClick={handleTonProxyToggle}>
            TON Proxy
            <Switcher className={styles.menuSwitcher} label="Toggle TON Proxy" checked={isTonProxyEnabled} />
          </MenuItem>
        )}
        {IS_EXTENSION && (
          <MenuItem onClick={handleTonMagicToggle}>
            TON Magic
            <Switcher className={styles.menuSwitcher} label="Toggle TON Magic" checked={isTonMagicEnabled} />
          </MenuItem>
        )}
        {isTelegramLinkRendered && (
          <MenuItem href={TELEGRAM_WEB_URL} className={telegramLinkClassNames}>
            Open Telegram Web
          </MenuItem>
        )}
        <MenuItem onClick={handleTinyTransfersHiddenToggle}>
          Hide Tiny Transfers
          <Switcher
            className={styles.menuSwitcher}
            label="Toggle Hide Tiny Transfers"
            checked={areTinyTransfersHidden}
          />
        </MenuItem>
        <MenuItem onClick={handleOpenBackupWallet}>Back Up</MenuItem>
        <MenuItem isDestructive onClick={handleOpenConfirmation}>Exit</MenuItem>
      </Menu>

      <Modal
        isOpen={isExitConfirmOpened}
        onClose={closeExitConfirm}
        title="Log Out"
      >
        <p className={styles.modalText}>
          This will disconnect the wallet from this app. You will be able to restore your
          wallet using <strong>{MNEMONIC_COUNT} secret words</strong> - or import another wallet.
        </p>
        <p className={styles.modalText}>
          Wallets are located in the decentralized TON Blockchain. If you want the wallet to
          be deleted simply transfer all the TON from it and leave it empty.
        </p>
        <div className={modalStyles.buttons}>
          <Button onClick={closeExitConfirm}>Cancel</Button>
          <Button isDestructive onClick={handleLogOut}>Exit</Button>
        </div>
      </Modal>
      {IS_EXTENSION && (
        <Modal isOpen={isAboutOpened} onClose={closeAbout} title="About" hasCloseButton>
          <img src={logoSrc} alt="Logo" className={styles.aboutLogo} />
          <p className={styles.modalTitle}>
            {APP_NAME} {APP_VERSION}
            <a href="https://mytonwallet.org/" target="_blank" className={styles.modalTitleLink} rel="noreferrer">
              https://mytonwallet.org/
            </a>
          </p>
          <p className={styles.modalText}>
            Securely store crypto and make blockchain payments at the <strong>speed of light</strong>.
          </p>
          <p className={styles.modalText}><strong>What is TON Magic?</strong></p>
          <p className={styles.modalText}>
            TON Magic provides native <strong>Telegram integration</strong> by patching the official Telegram Web app.
          </p>
          <p className={styles.modalText}>
            Turn it on to send and receive Toncoins from any Telegram user.{' '}
            <a href="https://telegra.ph/Telegram--TON-11-10" target="_blank" rel="noopener noreferrer">
              More info and demo.
            </a>
          </p>
          <div className={modalStyles.buttons}>
            <Button onClick={closeAbout}>Close</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  return {
    areTinyTransfersHidden: global.settings.areTinyTransfersHidden,
    isTonProxyEnabled: global.settings.isTonProxyEnabled,
    isTonMagicEnabled: global.settings.isTonMagicEnabled,
  };
})(Header));

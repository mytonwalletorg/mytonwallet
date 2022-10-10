import React, { memo } from '../../lib/teact/teact';

import { APP_NAME, APP_VERSION } from '../../config';
import { IS_EXTENSION } from '../../util/environment';

import Button from '../ui/Button';
import Modal from '../ui/Modal';

import styles from './AboutModal.module.scss';
import modalStyles from '../ui/Modal.module.scss';

import logoSrc from '../../assets/logo.svg';

interface OwnProps {
  isOpen: boolean;
  onClose: NoneToVoidFunction;
}

function AboutModal({ isOpen, onClose }: OwnProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="About" hasCloseButton>
      <img src={logoSrc} alt="Logo" className={styles.logo} />
      <p className={styles.title}>
        {APP_NAME} {APP_VERSION}
        <a href="https://mytonwallet.io/" target="_blank" className={styles.titleLink} rel="noreferrer">
          mytonwallet.io
        </a>
      </p>
      <p className={styles.text}>
        Securely store crypto, explore decentralized apps,
        and make blockchain payments at the <strong>speed of light</strong>.
      </p>
      <p className={styles.text}>
        The wallet is <strong>non-custodial and safe</strong>.
        The developers <strong>do not</strong> have access to your funds, browser history or any other information.
      </p>
      {IS_EXTENSION ? (
        <>
          <p />
          <p className={styles.text}>🥷 <strong>What is TON Proxy?</strong></p>
          <p className={styles.text}>
            TON Proxy opens a way to <strong>decentralized internet</strong> by
            allowing to anonymously access TON Sites.{' '}
            <a
              href="https://telegra.ph/TON-Sites-TON-WWW-and-TON-Proxy-09-29-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              More info and demo.
            </a>
          </p>
          <p />
          <p className={styles.text}>🦄 <strong>What is TON Magic?</strong></p>
          <p className={styles.text}>
            TON Magic provides native <strong>Telegram integration</strong> by patching the official Telegram Web
            app.
          </p>
          <p className={styles.text}>
            Turn it on to send and receive Toncoins from any Telegram user.{' '}
            <a href="https://telegra.ph/Telegram--TON-11-10" target="_blank" rel="noopener noreferrer">
              More info and demo.
            </a>
          </p>
        </>
      ) : (
        <>
          <p />
          <p className={styles.text}><strong>What about 🥷 TON Proxy and 🦄 TON Magic?</strong></p>
          <p className={styles.text}>
            To enjoy <strong>decentralized internet</strong>, access <strong>TON Sites</strong>,
            and leverage native <strong>Telegram integration</strong>, feel free to install the{' '}
            <a href="https://mytonwallet.io/" target="_blank" rel="noreferrer">
              <strong>MyTonWallet extension</strong>
            </a>.
          </p>
        </>
      )}
      <p />
      <p className={styles.text}>🕵️‍♀️ <strong>Is it open source?</strong></p>
      <p className={styles.text}>
        Yes, it is. Feel free to explore our{' '}
        <a href="https://github.com/mytonwalletorg/mytonwallet" target="_blank" rel="noreferrer">
          <strong>GitHub repository</strong>
        </a>.
      </p>
      <div className={modalStyles.buttons}>
        <Button onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}

export default memo(AboutModal);

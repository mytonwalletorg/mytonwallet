import React, { memo, useCallback } from '../../lib/teact/teact';

import { getActions } from '../../global';
import { APP_NAME } from '../../config';
import useShowTransition from '../../hooks/useShowTransition';
import useFlag from '../../hooks/useFlag';
import buildClassName from '../../util/buildClassName';

import AboutModal from '../common/AboutModal';
import Settings from '../common/SettingsModal';
import Button from '../ui/Button';

import styles from './Auth.module.scss';
import logoPath from '../../assets/logo.svg';

const AuthStart = () => {
  const {
    startCreatingWallet,
    startImportingWallet,
  } = getActions();

  const [isLogoReady, markLogoReady] = useFlag();
  const [isAboutOpened, openAbout, closeAbout] = useFlag(false);
  const [isSettingsOpened, openSettings, closeSettings] = useFlag(false);
  const { transitionClassNames } = useShowTransition(isLogoReady, undefined, undefined, 'slow');

  const handleCreateWallet = useCallback(() => {
    startCreatingWallet();
  }, [startCreatingWallet]);

  return (
    <div className={buildClassName(styles.container, 'custom-scroll')}>
      <img
        src={logoPath}
        alt={APP_NAME}
        className={buildClassName(styles.logo, transitionClassNames)}
        onLoad={markLogoReady}
      />
      <div className={styles.appName}>{APP_NAME}</div>
      <div className={styles.info}>
        <strong>Securely</strong> store crypto
        <br />and make blockchain payments
        <br />at the <strong>speed of light</strong>.
      </div>
      <div className={styles.buttons}>
        <Button
          isPrimary
          className={styles.btn}
          onClick={handleCreateWallet}
        >
          Create wallet
        </Button>
        <Button
          isText
          className={buildClassName(styles.btn, styles.btn_text)}
          onClick={startImportingWallet}
        >
          Import From 24 Secret Words
        </Button>
        <Button
          isText
          className={buildClassName(styles.btn, styles.btn_about)}
          onClick={openAbout}
        >
          About MyTonWallet
        </Button>
        <Button
          isText
          className={buildClassName(styles.btn, styles.btn_about)}
          onClick={openSettings}
        >
          Settings
        </Button>
      </div>
      <AboutModal isOpen={isAboutOpened} onClose={closeAbout} />
      <Settings isOpen={isSettingsOpened} onClose={closeSettings} />
    </div>
  );
};

export default memo(AuthStart);

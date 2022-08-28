import React, { memo, useCallback } from '../../lib/teact/teact';

import { getActions } from '../../global';
import { APP_NAME } from '../../config';
import useShowTransition from '../../hooks/useShowTransition';
import useFlag from '../../hooks/useFlag';
import buildClassName from '../../util/buildClassName';

import Button from '../ui/Button';

import styles from './Auth.module.scss';
import logoPath from '../../assets/logo.svg';

const AuthStart = () => {
  const {
    startCreatingWallet,
    startImportingWallet,
  } = getActions();

  const [isLogoReady, markLogoReady] = useFlag();
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
          Import from secret words
        </Button>
      </div>
    </div>
  );
};

export default memo(AuthStart);

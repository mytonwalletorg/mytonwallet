import React, { memo, useCallback } from '../../lib/teact/teact';

import { getActions } from '../../global';
import { APP_NAME, MNEMONIC_COUNT } from '../../config';
import renderText from '../../global/helpers/renderText';
import buildClassName from '../../util/buildClassName';
import useShowTransition from '../../hooks/useShowTransition';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';

import AboutModal from '../common/AboutModal';
import Button from '../ui/Button';

import styles from './Auth.module.scss';
import logoPath from '../../assets/logo.svg';

const AuthStart = () => {
  const {
    startCreatingWallet,
    startImportingWallet,
  } = getActions();

  const lang = useLang();
  const [isLogoReady, markLogoReady] = useFlag();
  const [isAboutOpened, openAbout, closeAbout] = useFlag(false);
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
        {renderText(lang('$auth_intro'))}
      </div>
      <div className={styles.buttons}>
        <Button
          isPrimary
          className={styles.btn}
          onClick={handleCreateWallet}
        >
          {lang('Create New Wallet')}
        </Button>
        <Button
          isText
          className={buildClassName(styles.btn, styles.btn_text)}
          onClick={startImportingWallet}
        >
          {lang('Import From %1$d Secret Words', MNEMONIC_COUNT)}
        </Button>
        <Button
          isText
          className={buildClassName(styles.btn, styles.btn_about)}
          onClick={openAbout}
        >
          {lang('About MyTonWallet')}
        </Button>
      </div>
      <AboutModal isOpen={isAboutOpened} onClose={closeAbout} />
    </div>
  );
};

export default memo(AuthStart);

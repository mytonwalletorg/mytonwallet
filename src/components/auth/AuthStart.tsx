import React, { memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { APP_NAME, MNEMONIC_COUNT } from '../../config';
import renderText from '../../global/helpers/renderText';
import buildClassName from '../../util/buildClassName';
import { IS_LEDGER_SUPPORTED } from '../../util/windowEnvironment';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useShowTransition from '../../hooks/useShowTransition';

import Button from '../ui/Button';

import styles from './Auth.module.scss';

import logoPath from '../../assets/logo.svg';

interface StateProps {
  hasAccounts?: boolean;
  isLoading?: boolean;
}

function AuthStart({ hasAccounts, isLoading }: StateProps) {
  const {
    startCreatingWallet,
    startImportingWallet,
    openAbout,
    openHardwareWalletModal,
    resetAuth,
  } = getActions();

  const lang = useLang();
  const [isLogoReady, markLogoReady] = useFlag();
  const { transitionClassNames } = useShowTransition(isLogoReady, undefined, undefined, 'slow');

  return (
    <div className={buildClassName(styles.container, 'custom-scroll')}>
      {hasAccounts && (
        <Button isSimple isText onClick={resetAuth} className={styles.headerBack}>
          <i className={buildClassName(styles.iconChevron, 'icon-chevron-left')} aria-hidden />
          <span>{lang('Back')}</span>
        </Button>
      )}

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
      <Button
        isText
        className={buildClassName(styles.btn, styles.btn_about)}
        onClick={openAbout}
      >
        {lang('More about MyTonWallet')}
        <i className="icon-chevron-right" aria-hidden />
      </Button>
      <div className={styles.importButtonsBlock}>
        <Button
          isPrimary
          className={styles.btn}
          isLoading={isLoading}
          onClick={!isLoading ? startCreatingWallet : undefined}
        >
          {lang('Create Wallet')}
        </Button>
        <span className={styles.importText}>{lang('or import from')}</span>
        <div className={styles.importButtons}>
          <Button
            className={buildClassName(styles.btn, !IS_LEDGER_SUPPORTED && styles.btn_single)}
            onClick={!isLoading ? startImportingWallet : undefined}
          >
            {lang('%1$d Secret Words', MNEMONIC_COUNT)}
          </Button>
          {IS_LEDGER_SUPPORTED && (
            <Button
              className={buildClassName(styles.btn, styles.btn_mini)}
              onClick={!isLoading ? openHardwareWalletModal : undefined}
            >
              {lang('Ledger')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(withGlobal((global): StateProps => {
  return {
    hasAccounts: Boolean(global.currentAccountId),
    isLoading: global.auth.isLoading,
  };
})(AuthStart));

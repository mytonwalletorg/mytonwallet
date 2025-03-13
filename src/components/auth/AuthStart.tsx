import React, { memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { type Theme } from '../../global/types';

import { APP_NAME, IS_CORE_WALLET } from '../../config';
import renderText from '../../global/helpers/renderText';
import buildClassName from '../../util/buildClassName';
import { IS_LEDGER_SUPPORTED } from '../../util/windowEnvironment';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';

import useAppTheme from '../../hooks/useAppTheme';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useShowTransition from '../../hooks/useShowTransition';

import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import Button from '../ui/Button';

import styles from './Auth.module.scss';

import logoDarkPath from '../../assets/logoDark.svg';
import logoLightPath from '../../assets/logoLight.svg';

interface OwnProps {
  isActive?: boolean;
}

interface StateProps {
  hasAccounts?: boolean;
  isLoading?: boolean;
  theme: Theme;
}

function AuthStart({
  isActive,
  hasAccounts,
  isLoading,
  theme,
}: OwnProps & StateProps) {
  const {
    startCreatingWallet,
    startImportingWallet,
    openAbout,
    openHardwareWalletModal,
    resetAuth,
  } = getActions();

  const lang = useLang();
  const appTheme = useAppTheme(theme);
  const logoPath = appTheme === 'light' ? logoLightPath : logoDarkPath;
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

      {IS_CORE_WALLET ? (
        <AnimatedIconWithPreview
          play={isActive}
          tgsUrl={ANIMATED_STICKERS_PATHS.coreWalletLogo}
          previewUrl={ANIMATED_STICKERS_PATHS.coreWalletLogoPreview}
          noLoop={false}
          nonInteractive
        />
      ) : (
        <img
          src={logoPath}
          alt={APP_NAME}
          className={buildClassName(styles.logo, transitionClassNames)}
          onLoad={markLogoReady}
        />
      )}

      <div className={buildClassName(styles.appName, 'rounded-font')}>{APP_NAME}</div>
      <div className={styles.info}>
        {renderText(lang('$auth_intro'))}
      </div>

      {!IS_CORE_WALLET && (
        <Button
          isText
          className={buildClassName(styles.btn, styles.btn_about)}
          onClick={openAbout}
        >
          {lang('More about %app_name%', { app_name: APP_NAME })}
          <i className="icon-chevron-right" aria-hidden />
        </Button>
      )}
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
            {lang('Secret Words')}
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

export default memo(withGlobal<OwnProps>((global): StateProps => {
  return {
    hasAccounts: Boolean(global.currentAccountId),
    isLoading: global.auth.isLoading,
    theme: global.settings.theme,
  };
})(AuthStart));

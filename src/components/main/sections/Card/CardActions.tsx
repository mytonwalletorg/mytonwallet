import React, { memo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import { IS_EXTENSION } from '../../../../config';
import { selectIsCurrentAccountViewMode } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { getTelegramApp } from '../../../../util/telegram';
import { getIsMobileTelegramApp, IS_ELECTRON, IS_IOS } from '../../../../util/windowEnvironment';

import { useDeviceScreen } from '../../../../hooks/useDeviceScreen';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import Button from '../../../ui/Button';

import styles from './AccountSelector.module.scss';

interface OwnProps {
  isInsideSticky?: boolean;
  isQrScannerSupported?: boolean;
  noSettingsOrQrSupported?: boolean;
  menuButtonClassName?: string;
  onQrScanClick: NoneToVoidFunction;
}

interface StateProps {
  isAppLockEnabled?: boolean;
  isSensitiveDataHidden?: boolean;
  isFullscreen?: boolean;
}

function CardActions({
  isInsideSticky,
  isSensitiveDataHidden,
  isAppLockEnabled,
  isFullscreen,
  isQrScannerSupported,
  noSettingsOrQrSupported,
  menuButtonClassName,
  onQrScanClick,
}: OwnProps & StateProps) {
  const {
    openSettings,
    requestOpenQrScanner,
    setIsManualLockActive,
    setIsSensitiveDataHidden,
    setAppLayout,
  } = getActions();

  const lang = useLang();
  const { isPortrait } = useDeviceScreen();

  const canToggleAppLayout = IS_EXTENSION || IS_ELECTRON;

  const handleSensitiveDataToggle = useLastCallback(() => {
    setIsSensitiveDataHidden({ isHidden: !isSensitiveDataHidden });
  });

  const handleQrScanClick = useLastCallback(() => {
    if (IS_IOS && getIsMobileTelegramApp()) {
      alert('Scanning is temporarily not available');
      return;
    }

    requestOpenQrScanner();
    onQrScanClick();
  });

  const handleFullscreenToggle = useLastCallback(() => {
    if (isFullscreen) {
      getTelegramApp()?.exitFullscreen();
    } else {
      getTelegramApp()?.requestFullscreen();
    }
  });

  const handleManualLock = useLastCallback(() => {
    setIsManualLockActive({ isActive: true, shouldHideBiometrics: true });
  });

  const handleAppLayoutToggle = useLastCallback(() => {
    setAppLayout({ layout: isPortrait ? 'landscape' : 'portrait' });
  });

  return (
    <div className={buildClassName(styles.menuButtons, isInsideSticky && styles.inStickyCard)}>
      {!isInsideSticky && (
        <Button
          className={buildClassName(styles.menuButton, menuButtonClassName)}
          isText
          isSimple
          kind="transparent"
          ariaLabel={lang(isSensitiveDataHidden ? 'Show Sensitive Data' : 'Hide Sensitive Data')}
          onClick={handleSensitiveDataToggle}
        >
          <i className={isSensitiveDataHidden ? 'icon-eye' : 'icon-eye-closed'} aria-hidden />
        </Button>
      )}
      {isAppLockEnabled && (
        <Button
          className={buildClassName(styles.menuButton, menuButtonClassName)}
          isText
          isSimple
          kind="transparent"
          ariaLabel={lang('App Lock')}
          onClick={handleManualLock}
        >
          <i className="icon-manual-lock" aria-hidden />
        </Button>
      )}
      {isQrScannerSupported && (
        <Button
          className={buildClassName(styles.menuButton, menuButtonClassName)}
          isText
          isSimple
          kind="transparent"
          ariaLabel={lang('Scan QR Code')}
          onClick={handleQrScanClick}
        >
          <i className="icon-qr-scanner" aria-hidden />
        </Button>
      )}
      {getIsMobileTelegramApp() && (
        <Button
          className={buildClassName(styles.menuButton, menuButtonClassName)}
          isText
          isSimple
          kind="transparent"
          ariaLabel={lang('Toggle fullscreen')}
          onClick={handleFullscreenToggle}
        >
          <i className={isFullscreen ? 'icon-fullscreen-exit' : 'icon-fullscreen'} aria-hidden />
        </Button>
      )}
      {canToggleAppLayout && (
        <Button
          className={buildClassName(styles.menuButton, menuButtonClassName)}
          isText
          isSimple
          kind="transparent"
          ariaLabel={lang(isPortrait ? 'Toggle to landscape layout' : 'Toggle to portrait layout')}
          onClick={handleAppLayoutToggle}
        >
          <i className={isPortrait ? 'icon-view-landscape' : 'icon-view-portrait'} aria-hidden />
        </Button>
      )}
      {!noSettingsOrQrSupported && (
        <Button
          className={buildClassName(styles.menuButton, menuButtonClassName)}
          isText
          isSimple
          kind="transparent"
          ariaLabel={lang('Main menu')}
          onClick={openSettings}
        >
          <i className="icon-cog" aria-hidden />
        </Button>
      )}
    </div>
  );
}

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const {
      isFullscreen,
      settings: {
        isAppLockEnabled,
        isSensitiveDataHidden,
      },
    } = global;

    const isViewMode = selectIsCurrentAccountViewMode(global);

    return {
      isAppLockEnabled: isAppLockEnabled && !isViewMode,
      isFullscreen,
      isSensitiveDataHidden,
    };
  },
  (global, _, stickToFirst) => stickToFirst(global.currentAccountId),
)(CardActions));

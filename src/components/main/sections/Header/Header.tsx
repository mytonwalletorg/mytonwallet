import React, { memo } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import { IS_CORE_WALLET, IS_EXTENSION, IS_TELEGRAM_APP } from '../../../../config';
import { selectIsCurrentAccountViewMode } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { IS_ELECTRON } from '../../../../util/windowEnvironment';

import { useDeviceScreen } from '../../../../hooks/useDeviceScreen';

import AccountSelector from './AccountSelector';
import AppLockButton from './actionButtons/AppLockButton';
import QrScannerButton from './actionButtons/QrScannerButton';
import SettingsButton from './actionButtons/SettingsButton';
import ToggleFullscreenButton from './actionButtons/ToggleFullscreenButton';
import ToggleLayoutButton from './actionButtons/ToggleLayoutButton';
import ToggleSensitiveDataButton from './actionButtons/ToggleSensitiveDataButton';

import styles from './Header.module.scss';

export const HEADER_HEIGHT_REM = 3;

interface OwnProps {
  withBalance?: boolean;
}

interface StateProps {
  isViewMode?: boolean;
  isAppLockEnabled?: boolean;
  isSensitiveDataHidden: boolean;
  isFullscreen: boolean;
}

function Header({
  isViewMode,
  withBalance,
  isAppLockEnabled,
  isSensitiveDataHidden,
  isFullscreen,
}: OwnProps & StateProps) {
  const { isPortrait } = useDeviceScreen();
  const canToggleAppLayout = IS_EXTENSION || IS_ELECTRON;

  if (isPortrait) {
    return (
      <div className={buildClassName(styles.header, withBalance && styles.withSeparator)}>
        <div className={styles.headerInner}>
          <QrScannerButton isViewMode={isViewMode} />
          <AccountSelector withBalance={withBalance} withAccountSelector={!IS_CORE_WALLET} />

          <div className={styles.portraitActions}>
            {isAppLockEnabled && <AppLockButton />}
            <ToggleSensitiveDataButton isSensitiveDataHidden={isSensitiveDataHidden} />
            {IS_TELEGRAM_APP && <ToggleFullscreenButton isFullscreen={isFullscreen} />}
            {canToggleAppLayout && <ToggleLayoutButton />}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.header}>
      <div className={styles.headerInner}>
        <div className={styles.landscapeActions}>
          <ToggleSensitiveDataButton isSensitiveDataHidden={isSensitiveDataHidden} />
          <QrScannerButton isViewMode={isViewMode} />
          {isAppLockEnabled && <AppLockButton />}
        </div>

        <AccountSelector withBalance={withBalance} withAccountSelector={!IS_CORE_WALLET} />

        <div className={styles.landscapeActions}>
          {IS_TELEGRAM_APP && <ToggleFullscreenButton isFullscreen={isFullscreen} />}
          {canToggleAppLayout && <ToggleLayoutButton />}
          <SettingsButton />
        </div>
      </div>
    </div>
  );
}

export default memo(withGlobal(
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
      isViewMode,
      isAppLockEnabled: isAppLockEnabled && !isViewMode,
      isFullscreen: Boolean(isFullscreen),
      isSensitiveDataHidden: Boolean(isSensitiveDataHidden),
    };
  },
  (global, _, stickToFirst) => stickToFirst(global.currentAccountId),
)(Header));

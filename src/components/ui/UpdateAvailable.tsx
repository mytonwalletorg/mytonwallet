import React, { memo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import {
  APP_INSTALL_URL,
  APP_NAME,
  APP_REPO_URL,
  IS_ANDROID_DIRECT,
  IS_FIREFOX_EXTENSION,
} from '../../config';
import buildClassName from '../../util/buildClassName';
import { openUrl } from '../../util/openUrl';
import {
  IS_ANDROID_APP,
  IS_CHROME_EXTENSION,
  IS_EDGE,
  IS_IOS_APP,
  IS_WEB,
} from '../../util/windowEnvironment';

import useLang from '../../hooks/useLang';
import useShowTransition from '../../hooks/useShowTransition';

import styles from './UpdateAvailable.module.scss';

interface StateProps {
  isAppUpdateAvailable?: boolean;
  isAppUpdateRequired?: boolean;
  newAppVersion?: string;
}

function UpdateAvailable({ isAppUpdateAvailable, newAppVersion, isAppUpdateRequired }: StateProps) {
  const lang = useLang();

  const { shouldRender, transitionClassNames } = useShowTransition(
    (IS_ANDROID_DIRECT && isAppUpdateAvailable) || isAppUpdateRequired,
  );

  const handleClick = () => {
    if (IS_WEB) {
      window.location.reload();
      return;
    }

    void openUrl(getUrl(newAppVersion), true);
  };

  if (!shouldRender) {
    return undefined;
  }

  return (
    <button type="button" className={buildClassName(styles.wrapper, transitionClassNames)} onClick={handleClick}>
      <i className={buildClassName('icon icon-download-filled', styles.icon)} aria-hidden />
      {lang('Update MyTonWallet')}
    </button>
  );
}

export default memo(withGlobal((global): StateProps => ({
  isAppUpdateAvailable: global.isAppUpdateAvailable,
  newAppVersion: global.latestAppVersion,
  isAppUpdateRequired: global.isAppUpdateRequired,
}))(UpdateAvailable));

function getUrl(appVersion?: string) {
  if (IS_ANDROID_DIRECT) {
    return appVersion
      ? `${APP_REPO_URL}/releases/download/v${encodeURIComponent(appVersion || '')}/${encodeURIComponent(APP_NAME)}.apk`
      : 'https://github.com/mytonwalletorg/mytonwallet/releases/latest';
  }

  if (IS_ANDROID_APP) {
    return `${APP_INSTALL_URL}android-store`;
  }

  if (IS_IOS_APP) {
    return `${APP_INSTALL_URL}ios`;
  }

  if (IS_CHROME_EXTENSION) {
    return `${APP_INSTALL_URL}${IS_EDGE ? 'edge-extension' : 'chrome-extension'}`;
  }

  if (IS_FIREFOX_EXTENSION) {
    return `${APP_INSTALL_URL}firefox-extension`;
  }

  return APP_INSTALL_URL;
}

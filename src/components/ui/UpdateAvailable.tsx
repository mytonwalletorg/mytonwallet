import React, { memo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import { APP_NAME, APP_REPO_URL } from '../../config';
import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';
import useShowTransition from '../../hooks/useShowTransition';

import styles from './UpdateAvailable.module.scss';

interface StateProps {
  isAppUpdateAvailable?: boolean;
  newAppVersion?: string;
}

function UpdateAvailable({ isAppUpdateAvailable, newAppVersion }: StateProps) {
  const lang = useLang();

  const { shouldRender, transitionClassNames } = useShowTransition(isAppUpdateAvailable);

  const handleClick = () => {
    // eslint-disable-next-line max-len
    const url = `${APP_REPO_URL}/releases/download/v${encodeURIComponent(newAppVersion || '')}/${encodeURIComponent(APP_NAME)}.apk`;
    window.open(url, '_blank', 'noopener');
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
}))(UpdateAvailable));

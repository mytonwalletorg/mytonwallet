import React, {
  memo, useEffect, useState,
} from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import { ElectronEvent } from '../../electron/types';

import { PRODUCTION_URL } from '../../config';
import buildClassName from '../../util/buildClassName';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useShowTransition from '../../hooks/useShowTransition';

import styles from './UpdateApp.module.scss';

type StateProps = {
  isAppUpdateAvailable?: boolean;
};

function UpdateApp({ isAppUpdateAvailable }: StateProps) {
  const lang = useLang();

  const [isElectronUpdateDownloaded, setIsElectronUpdateDownloaded] = useState(false);
  const [isElectronAutoUpdateEnabled, setIsElectronAutoUpdateEnabled] = useState(false);
  const [isDisabled, disable] = useFlag(false);

  useEffect(() => {
    const removeUpdateErrorListener = window.electron?.on(ElectronEvent.UPDATE_ERROR, () => {
      setIsElectronUpdateDownloaded(false);
    });
    const removeUpdateDownloadedListener = window.electron?.on(ElectronEvent.UPDATE_DOWNLOADED, () => {
      setIsElectronUpdateDownloaded(true);
    });

    window.electron?.getIsAutoUpdateEnabled().then(setIsElectronAutoUpdateEnabled);

    return () => {
      removeUpdateErrorListener?.();
      removeUpdateDownloadedListener?.();
    };
  }, []);

  const handleClick = useLastCallback(async () => {
    if (isDisabled) {
      return;
    }

    if (!isElectronAutoUpdateEnabled) {
      window.open(`${PRODUCTION_URL}/get`, '_blank', 'noopener');
      return;
    }

    if (isElectronUpdateDownloaded) {
      disable();
      await window.electron?.installUpdate();
      return;
    }

    if (isAppUpdateAvailable) {
      window.location.reload();
    }
  });

  const { transitionClassNames, shouldRender } = useShowTransition(isElectronUpdateDownloaded || isAppUpdateAvailable);

  if (!shouldRender) {
    return null; // eslint-disable-line no-null/no-null
  }

  return (
    <div
      className={buildClassName(
        styles.container,
        transitionClassNames,
        isDisabled && styles.disabled,
      )}
      onClick={handleClick}
    >
      <div className={styles.iconWrapper}>
        <i className={buildClassName('icon-update', styles.icon)} />
      </div>

      <div className={styles.text}>{lang('Update MyTonWallet')}</div>
    </div>
  );
}

export default memo(withGlobal((global): StateProps => {
  const { isAppUpdateAvailable } = global;

  return { isAppUpdateAvailable };
})(UpdateApp));

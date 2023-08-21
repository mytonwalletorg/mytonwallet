import React, { memo, useCallback } from '../../../../lib/teact/teact';

import { MY_TON_WALLET_PROMO_URL } from '../../../../config';
import { getActions, withGlobal } from '../../../../global';
import buildClassName from '../../../../util/buildClassName';

import { useDeviceScreen } from '../../../../hooks/useDeviceScreen';
import useLang from '../../../../hooks/useLang';
import useShowTransition from '../../../../hooks/useShowTransition';

import styles from './Warnings.module.scss';

type StateProps = {
  isSecurityWarningHidden?: boolean;
};

function SecurityWarning({ isSecurityWarningHidden }: StateProps) {
  const { closeSecurityWarning } = getActions();

  const { shouldRender, transitionClassNames } = useShowTransition(!isSecurityWarningHidden, undefined, true);
  const { isLandscape } = useDeviceScreen();

  const lang = useLang();

  function handleClick() {
    window.open(MY_TON_WALLET_PROMO_URL, '_blank', 'noopener');
  }

  const handleClose = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();

      closeSecurityWarning();
    },
    [closeSecurityWarning],
  );

  if (!shouldRender) {
    return undefined;
  }

  return (
    <div
      className={buildClassName(styles.wrapper, isLandscape && styles.wrapper_landscape, transitionClassNames)}
      onClick={handleClick}
    >
      {lang('Improve wallet security')}
      <i className={buildClassName(styles.icon, 'icon-chevron-right')} aria-hidden />
      <p className={styles.text}>{lang('by installing browser extension or native app')}</p>

      <button type="button" className={styles.closeButton} aria-label={lang('Close')} onClick={handleClose}>
        <i className="icon-close" aria-hidden />
      </button>
    </div>
  );
}

export default memo(
  withGlobal((global): StateProps => {
    return {
      isSecurityWarningHidden: global.settings.isSecurityWarningHidden,
    };
  })(SecurityWarning),
);

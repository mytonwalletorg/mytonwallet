import React, { memo, useCallback } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import { MY_TON_WALLET_PROMO_URL } from '../../../../config';
import { IS_EXTENSION } from '../../../../util/windowEnvironment';
import buildClassName from '../../../../util/buildClassName';
import useShowTransition from '../../../../hooks/useShowTransition';
import useLang from '../../../../hooks/useLang';

import styles from './Warnings.module.scss';

type StateProps = {
  isSecurityWarningHidden?: boolean;
};

const TEMPORARILY_DISABLED = true;

function SecurityWarning({ isSecurityWarningHidden }: StateProps) {
  const { closeSecurityWarning } = getActions();

  const canRender = !IS_EXTENSION && !isSecurityWarningHidden && !TEMPORARILY_DISABLED;
  const { shouldRender, transitionClassNames } = useShowTransition(canRender, undefined, true);

  const lang = useLang();

  function handleClick() {
    window.open(MY_TON_WALLET_PROMO_URL, '_blank', 'noopener');
  }

  const handleClose = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();

    closeSecurityWarning();
  }, [closeSecurityWarning]);

  if (!shouldRender) {
    return undefined;
  }

  return (
    <div className={buildClassName(styles.wrapper, transitionClassNames)} onClick={handleClick}>
      {lang('Improve wallet security')}
      <i className={buildClassName(styles.icon, 'icon-chevron-right')} />
      <p className={styles.text}>
        {lang('by installing browser extension or native app')}
      </p>

      <button
        type="button"
        className={styles.closeButton}
        aria-label={lang('Close')}
        onClick={handleClose}
      >
        <i className="icon-close" aria-hidden />
      </button>
    </div>
  );
}

export default memo(withGlobal((global): StateProps => {
  return {
    isSecurityWarningHidden: global.settings.isSecurityWarningHidden,
  };
})(SecurityWarning));

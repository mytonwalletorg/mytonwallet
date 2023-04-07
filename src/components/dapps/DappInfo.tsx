import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import useLang from '../../hooks/useLang';

import styles from './Dapp.module.scss';

interface OwnProps {
  iconUrl?: string;
  name?: string;
  url?: string;
  className?: string;
}

function DappInfo({
  iconUrl,
  name,
  url,
  className,
}: OwnProps) {
  const lang = useLang();

  function renderIcon() {
    if (iconUrl) {
      return (
        <img src={iconUrl} alt={lang('Logo')} className={styles.dappLogo} />
      );
    }

    return (
      <div className={buildClassName(styles.dappLogo, styles.dappLogo_icon)}>
        <i className={buildClassName(styles.dappIcon, 'icon-laptop')} aria-hidden />
      </div>
    );
  }

  return (
    <div className={buildClassName(styles.dapp, className)}>
      {renderIcon()}
      <div className={styles.dappInfo}>
        <span className={styles.dappName}>{name}</span>
        <span className={styles.dappUrl}>{url}</span>
      </div>
    </div>
  );
}

export default memo(DappInfo);

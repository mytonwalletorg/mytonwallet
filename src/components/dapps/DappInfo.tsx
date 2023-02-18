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

  return (
    <div className={buildClassName(styles.dapp, className)}>
      {iconUrl && <img src={iconUrl} alt={lang('Logo')} className={styles.dappLogo} />}
      <div className={styles.dappInfo}>
        <span className={styles.dappName}>{name}</span>
        <span className={styles.dappUrl}>{url}</span>
      </div>
    </div>
  );
}

export default memo(DappInfo);

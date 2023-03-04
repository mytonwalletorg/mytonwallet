import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import useLang from '../../hooks/useLang';

import styles from './Dapp.module.scss';
import Button from '../ui/Button';

interface OwnProps {
  iconUrl?: string;
  name?: string;
  url?: string;
  onDisconnect?: () => void;
  className?: string;
}

function DappInfo({
  iconUrl,
  name,
  url,
  onDisconnect,
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
      {onDisconnect && (
        <Button
          isSmall
          isPrimary
          className={styles.dappDisconnect}
          onClick={onDisconnect}
        >
          {lang('Disconnect')}
        </Button>
      )}
    </div>
  );
}

export default memo(DappInfo);

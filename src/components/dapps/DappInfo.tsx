import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Button from '../ui/Button';

import styles from './Dapp.module.scss';

interface OwnProps {
  iconUrl?: string;
  name?: string;
  url?: string;
  origin?: string;
  onDisconnect?: (origin: string) => void;
  className?: string;
}

function DappInfo({
  iconUrl,
  name,
  url,
  origin,
  onDisconnect,
  className,
}: OwnProps) {
  const lang = useLang();

  const shouldShowDisconnect = Boolean(onDisconnect && origin);

  const handleDisconnect = useLastCallback(() => {
    onDisconnect!(origin!);
  });

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
        <span className={styles.dappUrl}>{url && new URL(url).host}</span>
      </div>
      {shouldShowDisconnect && (
        <Button
          isSmall
          isPrimary
          className={styles.dappDisconnect}
          onClick={handleDisconnect}
        >
          {lang('Disconnect')}
        </Button>
      )}
    </div>
  );
}

export default memo(DappInfo);

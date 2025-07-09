import React, { memo, useMemo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiDapp } from '../../api/types';

import { IS_CAPACITOR } from '../../config';
import renderText from '../../global/helpers/renderText';
import buildClassName from '../../util/buildClassName';
import { getDappConnectionUniqueId } from '../../util/getDappConnectionUniqueId';
import { openUrl } from '../../util/openUrl';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Button from '../ui/Button';
import IconWithTooltip from '../ui/IconWithTooltip';

import styles from './Dapp.module.scss';

interface OwnProps {
  dapp?: ApiDapp;
  className?: string;
  onDisconnect?: (origin: string) => void;
}

function DappInfo({
  dapp,
  className,
  onDisconnect,
}: OwnProps) {
  const { deleteDapp } = getActions();

  const lang = useLang();

  const { name, iconUrl, url, isUrlEnsured } = dapp || {};
  const host = useMemo(() => url ? new URL(url).host : undefined, [url]);

  const shouldShowDisconnect = Boolean(onDisconnect && url);

  const handleDisconnect = useLastCallback(() => {
    onDisconnect!(url!);
  });

  function handleHostWarningIabButtonClick() {
    deleteDapp({ url: url!, uniqueId: getDappConnectionUniqueId(dapp!) });
    void openUrl(url!);
  }

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

  function renderWarningIcon() {
    return (
      <IconWithTooltip
        message={(
          <>
            <b>{lang('Unverified Source')}</b>
            <p className={styles.dappHostWarningText}>
              {renderText(lang('$reopen_in_iab', {
                browserButton: IS_CAPACITOR && url?.startsWith('http') ? (
                  <button className={styles.dappHostWarningButton} onClick={handleHostWarningIabButtonClick}>
                    {lang('MyTonWallet Browser')}
                  </button>
                ) : (
                  <b>{lang('MyTonWallet Browser')}</b>
                ),
              }))}
            </p>
          </>
        )}
        type="warning"
        size="small"
        iconClassName={styles.dappHostWarningIcon}
      />
    );
  }

  return (
    <div className={buildClassName(styles.dapp, className)}>
      {renderIcon()}
      <div className={styles.dappInfo}>
        <span className={styles.dappName}>{name}</span>
        <span className={styles.dappHost}>
          {!isUrlEnsured && renderWarningIcon()}
          {host}
        </span>
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

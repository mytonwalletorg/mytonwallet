import type { URLOpenListenerEvent } from '@capacitor/app';
import { App as CapacitorApp } from '@capacitor/app';
import React, { memo, useEffect } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import { ElectronEvent } from '../../../../electron/types';

import buildClassName from '../../../../util/buildClassName';
import { clearLaunchUrl, getLaunchUrl } from '../../../../util/capacitor';
import { processDeeplink } from '../../../../util/processDeeplink';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import Button from '../../../ui/Button';

import styles from './PortraitActions.module.scss';

interface OwnProps {
  hasStaking?: boolean;
  isTestnet?: boolean;
  isUnstakeRequested?: boolean;
  onEarnClick: NoneToVoidFunction;
  onReceiveClick: NoneToVoidFunction;
  isLedger?: boolean;
  isSwapDisabled?: boolean;
}

function PortraitActions({
  hasStaking,
  isTestnet,
  isUnstakeRequested,
  onEarnClick,
  onReceiveClick,
  isLedger,
  isSwapDisabled,
}: OwnProps) {
  const { startTransfer, startSwap } = getActions();

  const lang = useLang();

  const isSwapAllowed = !isTestnet && !isLedger && !isSwapDisabled;
  const isStakingAllowed = !isTestnet && !isLedger;

  useEffect(() => {
    return window.electron?.on(ElectronEvent.DEEPLINK, ({ url }: { url: string }) => {
      processDeeplink(url);
    });
  }, [startTransfer]);

  useEffect(() => {
    const launchUrl = getLaunchUrl();
    if (launchUrl) {
      processDeeplink(launchUrl);
      clearLaunchUrl();
    }

    return CapacitorApp.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      processDeeplink(event.url);
    }).remove;
  }, [startTransfer]);

  const handleStartSwap = useLastCallback(() => {
    startSwap({ isPortrait: true });
  });

  const handleStartTransfer = useLastCallback(() => {
    startTransfer({ isPortrait: true });
  });

  return (
    <div className={styles.container}>
      <div className={styles.buttons}>
        <Button className={styles.button} onClick={onReceiveClick} isSimple>
          <i className={buildClassName(styles.buttonIcon, 'icon-receive')} aria-hidden />
          {lang('Receive')}
        </Button>
        <Button className={styles.button} onClick={handleStartTransfer} isSimple>
          <i className={buildClassName(styles.buttonIcon, 'icon-send')} aria-hidden />
          {lang('Send')}
        </Button>
        {isSwapAllowed && (
          <Button className={styles.button} onClick={handleStartSwap} isSimple>
            <i className={buildClassName(styles.buttonIcon, 'icon-swap')} aria-hidden />
            {lang('Swap')}
          </Button>
        )}
        {isStakingAllowed && (
          <Button
            className={buildClassName(styles.button, hasStaking && styles.button_purple)}
            onClick={onEarnClick}
            isSimple
          >
            <i className={buildClassName(styles.buttonIcon, 'icon-earn')} aria-hidden />
            {lang(isUnstakeRequested ? 'Unstaking' : hasStaking ? 'Earning' : 'Earn')}
          </Button>
        )}
      </div>
    </div>
  );
}

export default memo(PortraitActions);

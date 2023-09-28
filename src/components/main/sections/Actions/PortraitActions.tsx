import React, { memo, useEffect } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import { ElectronEvent } from '../../../../electron/types';

import { TON_TOKEN_SLUG } from '../../../../config';
import { bigStrToHuman } from '../../../../global/helpers';
import buildClassName from '../../../../util/buildClassName';

import useLang from '../../../../hooks/useLang';

import Button from '../../../ui/Button';

import styles from './PortraitActions.module.scss';

interface OwnProps {
  hasStaking?: boolean;
  isTestnet?: boolean;
  isUnstakeRequested?: boolean;
  onEarnClick: NoneToVoidFunction;
  onReceiveClick: NoneToVoidFunction;
  isLedger?: boolean;
}

function PortraitActions({
  hasStaking, isTestnet, isUnstakeRequested, onEarnClick, onReceiveClick, isLedger,
}: OwnProps) {
  const { startTransfer } = getActions();

  const lang = useLang();

  useEffect(() => {
    return window.electron?.on(ElectronEvent.DEEPLINK, (params: any) => {
      startTransfer({
        tokenSlug: TON_TOKEN_SLUG,
        toAddress: params.to,
        amount: bigStrToHuman(params.amount),
        comment: params.text,
      });
    });
  }, [startTransfer]);

  return (
    <div className={styles.container}>
      <div className={styles.buttons}>
        <Button className={styles.button} onClick={onReceiveClick} isSimple>
          <i className={buildClassName(styles.buttonIcon, 'icon-receive')} aria-hidden />
          {lang('Receive')}
        </Button>
        <Button className={styles.button} onClick={startTransfer} isSimple>
          <i className={buildClassName(styles.buttonIcon, 'icon-send')} aria-hidden />
          {lang('Send')}
        </Button>
        {!isTestnet && !isLedger && (
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

import React, { memo } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import buildClassName from '../../../../util/buildClassName';
import useFlag from '../../../../hooks/useFlag';
import useLang from '../../../../hooks/useLang';

import Button from '../../../ui/Button';

import ReceiveModal from '../../modals/ReceiveModal';

import styles from './Actions.module.scss';

interface OwnProps {
  hasStaking?: boolean;
  onEarnClick: NoneToVoidFunction;
}

function Actions({ hasStaking, onEarnClick }: OwnProps) {
  const { startTransfer } = getActions();

  const lang = useLang();
  const [isReceiveTonOpened, openReceiveTon, closeReceiveTon] = useFlag(false);

  return (
    <div className={styles.container}>
      <div className={styles.buttons}>
        <Button className={styles.button} onClick={openReceiveTon} isSimple>
          <i className={buildClassName(styles.buttonIcon, 'icon-receive')} aria-hidden />
          {lang('Receive')}
        </Button>
        <Button className={styles.button} onClick={startTransfer} isSimple>
          <i className={buildClassName(styles.buttonIcon, 'icon-send')} aria-hidden />
          {lang('Send')}
        </Button>
        <Button
          className={buildClassName(styles.button, hasStaking && styles.button_purple)}
          onClick={onEarnClick}
          isSimple
        >
          <i className={buildClassName(styles.buttonIcon, 'icon-earn')} aria-hidden />
          {lang(hasStaking ? 'Earning' : 'Earn')}
        </Button>
      </div>
      <ReceiveModal isOpen={isReceiveTonOpened} onClose={closeReceiveTon} />
    </div>
  );
}

export default memo(Actions);

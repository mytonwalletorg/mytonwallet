import React, { memo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Button from '../ui/Button';
import Modal from '../ui/Modal';

import styles from './Auth.module.scss';

interface OwnProps {
  isOpen: boolean;
  onClose: NoneToVoidFunction;
}

function AuthDisclaimerConfirmed({ isOpen, onClose }: OwnProps) {
  const { confirmDisclaimer } = getActions();

  const handleBackupClick = useLastCallback(() => {
    onClose();
    confirmDisclaimer();
  });

  const lang = useLang();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      forceBottomSheet
      nativeBottomSheetKey="disclaimer-confirmed"
      dialogClassName={styles.disclaimerBackupDialog}
    >
      <div className={styles.backupNoticeButtons}>
        <Button
          isPrimary
          className={buildClassName(styles.btn, styles.btn_wide, styles.btn_single)}
          onClick={handleBackupClick}
        >
          {lang('Start Wallet')}
        </Button>
      </div>
    </Modal>
  );
}

export default memo(AuthDisclaimerConfirmed);

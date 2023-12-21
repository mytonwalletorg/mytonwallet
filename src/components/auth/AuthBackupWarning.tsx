import React, { memo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import renderText from '../../global/helpers/renderText';
import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';

import Button from '../ui/Button';
import Modal from '../ui/Modal';

import styles from './Auth.module.scss';

interface OwnProps {
  isOpen: boolean;
  onSkip: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
}

function AuthBackupWarning({ isOpen, onSkip, onClose }: OwnProps) {
  const { openAuthBackupWalletModal } = getActions();

  const lang = useLang();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      forceBottomSheet
      nativeBottomSheetKey="backup-warning"
      dialogClassName={styles.disclaimerBackupDialog}
    >
      <p className={styles.backupNotice}>{renderText(lang('$auth_backup_warning_notice'))}</p>
      <div className={styles.backupNoticeButtons}>
        <Button isPrimary className={buildClassName(styles.btn, styles.btn_wide)} onClick={openAuthBackupWalletModal}>
          {lang('Back Up Now')}
        </Button>
        <Button
          isDestructive
          className={buildClassName(styles.btn, styles.btn_mini)}
          onClick={onSkip}
        >
          {lang('Later')}
        </Button>
      </div>
    </Modal>
  );
}

export default memo(AuthBackupWarning);

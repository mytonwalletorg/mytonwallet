import React, { memo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import { IS_PRODUCTION } from '../../config';
import renderText from '../../global/helpers/renderText';
import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

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

  const handleBackupClick = useLastCallback(() => {
    onClose();
    openAuthBackupWalletModal();
  });

  const lang = useLang();

  const canSkipMnemonicCheck = !IS_PRODUCTION;

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
        <Button
          isPrimary
          className={buildClassName(styles.btn, styles.btn_wide, !canSkipMnemonicCheck && styles.btn_single)}
          onClick={handleBackupClick}
        >
          {lang('Back Up Now')}
        </Button>
        {canSkipMnemonicCheck && (
          <Button
            isDestructive
            className={buildClassName(styles.btn, styles.btn_mini)}
            onClick={onSkip}
          >
            {lang('Later')}
          </Button>
        )}
      </div>
    </Modal>
  );
}

export default memo(AuthBackupWarning);

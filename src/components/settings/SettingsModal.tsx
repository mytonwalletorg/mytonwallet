import React, { memo } from '../../lib/teact/teact';

import { IS_ELECTRON, IS_EXTENSION } from '../../config';
import buildClassName from '../../util/buildClassName';

import Modal from '../ui/Modal';

import styles from './Settings.module.scss';

type OwnProps = {
  children: React.ReactNode;
  isOpen?: boolean;
  onClose: () => void;
};

function SettingsModal({ children, isOpen, onClose }: OwnProps) {
  const fullDialogClassName = buildClassName(
    styles.modalDialog,
    !(IS_ELECTRON || IS_EXTENSION) && styles.modalDialogWeb,
  );

  return (
    <Modal
      hasCloseButton
      isOpen={isOpen}
      onClose={onClose}
      dialogClassName={fullDialogClassName}
      contentClassName={styles.modalContent}
    >
      {children}
    </Modal>
  );
}

export default memo(SettingsModal);

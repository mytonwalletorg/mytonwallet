import React, { memo } from '../../lib/teact/teact';

import Modal from '../ui/Modal';

import styles from './Settings.module.scss';

type OwnProps = {
  children: React.ReactNode;
  isOpen?: boolean;
  onClose: () => void;
};

function SettingsModal({ children, isOpen, onClose }: OwnProps) {
  return (
    <Modal
      hasCloseButton
      isSlideUp
      isOpen={isOpen}
      onClose={onClose}
      dialogClassName={styles.modalDialog}
    >
      {children}
    </Modal>
  );
}

export default memo(SettingsModal);

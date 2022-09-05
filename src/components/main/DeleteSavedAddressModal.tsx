import React, { memo, useCallback } from '../../lib/teact/teact';
import { getActions } from '../../global';

import Modal from '../ui/Modal';
import Button from '../ui/Button';

import styles from './DeleteSavedAddressModal.module.scss';
import modalStyles from '../ui/Modal.module.scss';

interface OwnProps {
  isOpen?: boolean;
  address?: string;
  onClose: NoneToVoidFunction;
}

function DeleteSavedAddressModal({ isOpen, address, onClose }: OwnProps) {
  const { removeFromSavedAddress } = getActions();

  const handleDeleteSavedAddress = useCallback(() => {
    if (!address) {
      return;
    }

    removeFromSavedAddress({ address });
    onClose();
  }, [address, onClose, removeFromSavedAddress]);

  return (
    <Modal
      title="Delete Saved Address"
      isOpen={isOpen}
      onClose={onClose}
    >
      <p className={styles.text}>Are you sure you want to remove this address from your saved ones?</p>

      <p className={styles.text}>You will be able to save it again via Transaction Info with this address.</p>

      <div className={modalStyles.buttons}>
        <Button onClick={onClose}>Cancel</Button>
        <Button isDestructive onClick={handleDeleteSavedAddress}>Delete</Button>
      </div>
    </Modal>
  );
}

export default memo(DeleteSavedAddressModal);

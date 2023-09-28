import React, { memo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Button from '../../ui/Button';
import Modal from '../../ui/Modal';

import modalStyles from '../../ui/Modal.module.scss';
import styles from './DeleteSavedAddressModal.module.scss';

interface OwnProps {
  isOpen?: boolean;
  address?: string;
  onClose: NoneToVoidFunction;
}

function DeleteSavedAddressModal({ isOpen, address, onClose }: OwnProps) {
  const { removeFromSavedAddress, showNotification } = getActions();

  const lang = useLang();

  const handleDeleteSavedAddress = useLastCallback(() => {
    if (!address) {
      return;
    }

    removeFromSavedAddress({ address });
    showNotification({ message: lang('Address removed from saved') as string, icon: 'icon-trash' });
    onClose();
  });

  return (
    <Modal
      title={lang('Delete Saved Address')}
      isCompact
      isOpen={isOpen}
      onClose={onClose}
    >
      <p className={styles.text}>{lang('Are you sure you want to remove this address from your saved ones?')}</p>

      <p className={styles.text}>{lang('You will be able to save it again via Transaction Info with this address.')}</p>

      <div className={modalStyles.buttons}>
        <Button onClick={onClose} className={modalStyles.button}>{lang('Cancel')}</Button>
        <Button isDestructive onClick={handleDeleteSavedAddress} className={modalStyles.button}>
          {lang('Delete')}
        </Button>
      </div>
    </Modal>
  );
}

export default memo(DeleteSavedAddressModal);

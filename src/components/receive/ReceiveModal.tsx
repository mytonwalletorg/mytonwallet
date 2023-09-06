import React, { memo } from '../../lib/teact/teact';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Modal from '../ui/Modal';
import Content from './Content';
import InvoiceModal from './InvoiceModal';
import QrModal from './QrModal';

import styles from './ReceiveModal.module.scss';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

function ReceiveModal({ isOpen, onClose }: Props) {
  const lang = useLang();
  const [isQrModalOpen, openQrModal, closeQrModal] = useFlag(false);
  const [isInvoiceModalOpen, openInvoiceModal, closeInvoiceModal] = useFlag(false);

  const handleClose = useLastCallback(() => {
    onClose();
    closeInvoiceModal();
    closeQrModal();
  });

  return (
    <>
      <Modal hasCloseButton title={lang('Receive TON')} isOpen={isOpen} onClose={handleClose}>
        <div className={styles.content}>
          <Content onInvoiceModalOpen={openInvoiceModal} onQrModalOpen={openQrModal} />
        </div>
      </Modal>
      <QrModal isOpen={isQrModalOpen} onBackButtonClick={closeQrModal} onClose={handleClose} />
      <InvoiceModal isOpen={isInvoiceModalOpen} onBackButtonClick={closeInvoiceModal} onClose={handleClose} />
    </>
  );
}

export default memo(ReceiveModal);

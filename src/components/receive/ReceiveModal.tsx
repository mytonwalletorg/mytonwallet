import React, { memo, useCallback } from '../../lib/teact/teact';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';

import Modal from '../ui/Modal';
import ModalTransitionContent from '../ui/ModalTransitionContent';
import Content from './Content';
import InvoiceModal from './InvoiceModal';
import QrModal from './QrModal';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

function ReceiveModal({ isOpen, onClose }: Props) {
  const lang = useLang();
  const [isQrModalOpen, openQrModal, closeQrModal] = useFlag(false);
  const [isInvoiceModalOpen, openInvoiceModal, closeInvoiceModal] = useFlag(false);

  const handleClose = useCallback(() => {
    onClose();
    closeInvoiceModal();
    closeQrModal();
  }, [closeInvoiceModal, closeQrModal, onClose]);

  return (
    <>
      <Modal isSlideUp hasCloseButton title={lang('Receive TON')} isOpen={isOpen} onClose={handleClose}>
        <ModalTransitionContent>
          <Content onInvoiceModalOpen={openInvoiceModal} onQrModalOpen={openQrModal} />
        </ModalTransitionContent>
      </Modal>
      <QrModal isOpen={isQrModalOpen} onBackButtonClick={closeQrModal} onClose={handleClose} />
      <InvoiceModal isOpen={isInvoiceModalOpen} onBackButtonClick={closeInvoiceModal} onClose={handleClose} />
    </>
  );
}

export default memo(ReceiveModal);

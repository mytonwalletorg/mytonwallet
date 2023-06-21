import React, { memo, useCallback } from '../../lib/teact/teact';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';

import Content from './Content';
import InvoiceModal from './InvoiceModal';
import QrModal from './QrModal';

type Props = {
  className?: string;
};

function ReceiveStatic({ className }: Props) {
  const lang = useLang();
  const [isQrModalOpen, openQrModal, closeQrModal] = useFlag(false);
  const [isInvoiceModalOpen, openInvoiceModal, closeInvoiceModal] = useFlag(false);

  const handleClose = useCallback(() => {
    closeInvoiceModal();
    closeQrModal();
  }, [closeInvoiceModal, closeQrModal]);

  return (
    <div className={className}>
      <Content isStatic onInvoiceModalOpen={openInvoiceModal} onQrModalOpen={openQrModal} />
      <QrModal
        backButtonText={lang('Close')}
        isOpen={isQrModalOpen}
        onBackButtonClick={closeQrModal}
        onClose={handleClose}
      />
      <InvoiceModal
        backButtonText={lang('Close')}
        isOpen={isInvoiceModalOpen}
        onBackButtonClick={closeInvoiceModal}
        onClose={handleClose}
      />
    </div>
  );
}

export default memo(ReceiveStatic);

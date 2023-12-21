import React, { memo } from '../../lib/teact/teact';

import useFlag from '../../hooks/useFlag';

import Content from './Content';
import InvoiceModal from './InvoiceModal';

type Props = {
  className?: string;
};

function ReceiveStatic({ className }: Props) {
  const [isInvoiceModalOpen, openInvoiceModal, closeInvoiceModal] = useFlag(false);

  return (
    <div className={className}>
      <Content isStatic isOpen onInvoiceModalOpen={openInvoiceModal} />
      <InvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={closeInvoiceModal}
      />
    </div>
  );
}

export default memo(ReceiveStatic);

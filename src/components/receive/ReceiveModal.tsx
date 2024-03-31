import { BottomSheet } from 'native-bottom-sheet';
import React, { memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { IS_DELEGATED_BOTTOM_SHEET } from '../../util/windowEnvironment';

import { useOpenFromMainBottomSheet } from '../../hooks/useDelegatedBottomSheet';
import { useOpenFromNativeBottomSheet } from '../../hooks/useDelegatingBottomSheet';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Modal from '../ui/Modal';
import Content from './Content';
import InvoiceModal from './InvoiceModal';

import styles from './ReceiveModal.module.scss';

type StateProps = {
  isOpen?: boolean;
};

function ReceiveModal({
  isOpen,
}: StateProps) {
  const {
    closeReceiveModal,
  } = getActions();
  const lang = useLang();
  const [isInvoiceModalOpen, openInvoiceModal, closeInvoiceModal] = useFlag(false);

  useOpenFromNativeBottomSheet('invoice', openInvoiceModal);
  useOpenFromMainBottomSheet('invoice', openInvoiceModal);

  const handleOpenInvoiceModal = useLastCallback(() => {
    closeReceiveModal();

    if (IS_DELEGATED_BOTTOM_SHEET) {
      BottomSheet.openInMain({ key: 'invoice' });
    } else {
      openInvoiceModal();
    }
  });

  const handleClose = useLastCallback(() => {
    closeReceiveModal();
    closeInvoiceModal();
  });

  return (
    <>
      <Modal
        isOpen={isOpen}
        title={lang('Receive')}
        hasCloseButton
        contentClassName={styles.content}
        nativeBottomSheetKey="receive"
        onClose={closeReceiveModal}
      >
        <Content
          isOpen={isOpen}
          onInvoiceModalOpen={handleOpenInvoiceModal}
        />
      </Modal>
      <InvoiceModal isOpen={isInvoiceModalOpen} onClose={handleClose} />
    </>
  );
}

export default memo(withGlobal((global): StateProps => {
  return {
    isOpen: global.isReceiveModalOpen,
  };
})(ReceiveModal));

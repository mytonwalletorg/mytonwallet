import { BottomSheet } from 'native-bottom-sheet';
import React, { memo, useEffect } from '../../lib/teact/teact';

import { IS_DELEGATED_BOTTOM_SHEET } from '../../util/windowEnvironment';

import { useOpenFromMainBottomSheet } from '../../hooks/useDelegatedBottomSheet';
import { useOpenFromNativeBottomSheet } from '../../hooks/useDelegatingBottomSheet';
import { useDeviceScreen } from '../../hooks/useDeviceScreen';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Modal from '../ui/Modal';
import Content from './Content';
import InvoiceModal from './InvoiceModal';

import styles from './ReceiveModal.module.scss';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

function ReceiveModal({ isOpen, onClose }: Props) {
  const lang = useLang();
  const { isPortrait } = useDeviceScreen();
  const [isInvoiceModalOpen, openInvoiceModal, closeInvoiceModal] = useFlag(false);

  useOpenFromNativeBottomSheet('invoice', openInvoiceModal);
  useOpenFromMainBottomSheet('invoice', openInvoiceModal);

  useEffect(() => {
    if (isOpen && !isPortrait) {
      onClose();
    }
  }, [isOpen, isPortrait, onClose]);

  const handleOpenInvoiceModal = useLastCallback(() => {
    onClose();

    if (IS_DELEGATED_BOTTOM_SHEET) {
      BottomSheet.openInMain({ key: 'invoice' });
    } else {
      openInvoiceModal();
    }
  });

  const handleClose = useLastCallback(() => {
    onClose();
    closeInvoiceModal();
  });

  return (
    <>
      <Modal
        isOpen={isOpen}
        title={lang('Receive TON')}
        hasCloseButton
        contentClassName={styles.content}
        nativeBottomSheetKey="receive"
        onClose={onClose}
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

export default memo(ReceiveModal);

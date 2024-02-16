import React, { memo } from '../../lib/teact/teact';

import useLang from '../../hooks/useLang';

import Modal from '../ui/Modal';
import AddBuyStatic from './AddBuyStatic';

import styles from './AddBuyModal.module.scss';

interface OwnProps {
  isOpen: boolean;
  isTestnet?: boolean;
  isLedgerWallet?: boolean;
  isSwapDisabled?: boolean;
  isOnRampDisabled?: boolean;
  onClose: NoneToVoidFunction;
}

function AddBuyModal({
  isOpen,
  isTestnet,
  isLedgerWallet,
  isSwapDisabled,
  isOnRampDisabled,
  onClose,
}: OwnProps) {
  const lang = useLang();

  return (
    <Modal
      title={lang('Get TON')}
      isOpen={isOpen}
      onClose={onClose}
      hasCloseButton
      dialogClassName={styles.actionSheetDialog}
    >
      <AddBuyStatic
        isLedger={isLedgerWallet}
        isTestnet={isTestnet}
        isSwapDisabled={isSwapDisabled}
        isOnRampDisabled={isOnRampDisabled}
        onClose={onClose}
      />
    </Modal>
  );
}

export default memo(AddBuyModal);

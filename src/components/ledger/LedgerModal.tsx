import React, {
  memo, useCallback, useState,
} from '../../lib/teact/teact';

import type { Account, HardwareConnectState } from '../../global/types';
import type { LedgerWalletInfo } from '../../util/ledger/types';

import { getActions, withGlobal } from '../../global';
import { selectNetworkAccounts } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';

import Modal from '../ui/Modal';
import Transition from '../ui/Transition';
import LedgerConnect from './LedgerConnect';
import LedgerSelectWallets from './LedgerSelectWallets';

import modalStyles from '../ui/Modal.module.scss';
import styles from './LedgerModal.module.scss';

type OwnProps = {
  isOpen?: boolean;
  onClose: () => void;
};

type StateProps = {
  hardwareWallets?: LedgerWalletInfo[];
  accounts?: Record<string, Account>;
  hardwareState?: HardwareConnectState;
  isLedgerConnected?: boolean;
  isTonAppConnected?: boolean;
  isRemoteTab?: boolean;
};

enum LedgerModalState {
  Password,
  Connect,
  SelectWallets,
}

function LedgerModal({
  isOpen,
  onClose,
  hardwareWallets,
  accounts,
  hardwareState,
  isLedgerConnected,
  isTonAppConnected,
  isRemoteTab,
}: OwnProps & StateProps) {
  const {
    resetHardwareWalletConnect,
  } = getActions();
  const [currentSlide, setCurrentSlide] = useState<number>(
    LedgerModalState.Connect,
  );
  const [nextKey] = useState<number | undefined>(
    LedgerModalState.SelectWallets,
  );

  const handleConnected = useCallback(() => {
    setCurrentSlide(LedgerModalState.SelectWallets);
  }, []);

  const handleLedgerModalClose = useCallback(() => {
    setCurrentSlide(LedgerModalState.Connect);
    resetHardwareWalletConnect();
  }, [resetHardwareWalletConnect]);

  // eslint-disable-next-line consistent-return
  function renderContent(isActive: boolean, isFrom: boolean, currentKey: number) {
    switch (currentKey) {
      case LedgerModalState.Connect:
        return (
          <LedgerConnect
            state={hardwareState}
            isLedgerConnected={isLedgerConnected}
            isTonAppConnected={isTonAppConnected}
            isRemoteTab={isRemoteTab}
            onConnected={handleConnected}
            onClose={onClose}
          />
        );
      case LedgerModalState.SelectWallets:
        return <LedgerSelectWallets accounts={accounts} hardwareWallets={hardwareWallets} onClose={onClose} />;
    }
  }

  return (
    <Modal
      hasCloseButton
      isSlideUp
      isOpen={isOpen}
      onClose={onClose}
      onCloseAnimationEnd={handleLedgerModalClose}
      dialogClassName={styles.modalDialog}
    >
      <Transition
        name="pushSlide"
        className={buildClassName(modalStyles.transition, 'custom-scroll')}
        slideClassName={modalStyles.transitionSlide}
        activeKey={currentSlide}
        nextKey={nextKey}
      >
        {renderContent}
      </Transition>
    </Modal>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const accounts = selectNetworkAccounts(global);

  const {
    hardwareWallets,
    hardwareState,
    isLedgerConnected,
    isTonAppConnected,
    isRemoteTab,
  } = global.hardware;

  return {
    accounts,
    hardwareWallets,
    hardwareState,
    isLedgerConnected,
    isTonAppConnected,
    isRemoteTab,
  };
})(LedgerModal));

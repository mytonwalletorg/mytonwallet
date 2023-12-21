import React, { memo, useState } from '../../lib/teact/teact';
import { getActions } from '../../global';

import resolveModalTransitionName from '../../util/resolveModalTransitionName';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Modal from '../ui/Modal';
import Transition from '../ui/Transition';
import MnemonicCheck from './MnemonicCheck';
import MnemonicList from './MnemonicList';
import SafetyRules from './SafetyRules';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Auth.module.scss';

interface OwnProps {
  isOpen?: boolean;
  mnemonic?: string[];
  checkIndexes?: number[];
}

const SLIDE_ANIMATION_DURATION_MS = 250;

enum BackupState {
  Accept,
  View,
  Confirm,
}
function AuthBackupWalletModal({
  isOpen, mnemonic, checkIndexes,
}: OwnProps) {
  const {
    restartCheckMnemonicIndexes,
    closeAuthBackupWalletModal,
  } = getActions();

  const lang = useLang();
  const [renderingKey, setRenderingKey] = useState<number>(BackupState.Accept);
  const [nextKey, setNextKey] = useState<number | undefined>(BackupState.View);

  const handleModalClose = useLastCallback(() => {
    setRenderingKey(BackupState.Accept);
    setNextKey(BackupState.View);
  });

  const handleMnemonicView = useLastCallback(() => {
    setRenderingKey(BackupState.View);
    setNextKey(BackupState.Confirm);
  });
  const handleRestartCheckMnemonic = useLastCallback(() => {
    handleMnemonicView();

    setTimeout(() => {
      restartCheckMnemonicIndexes();
    }, SLIDE_ANIMATION_DURATION_MS);
  });

  const handleShowMnemonicCheck = useLastCallback(() => {
    setRenderingKey(BackupState.Confirm);
    setNextKey(undefined);
  });

  const handleMnemonicCheckSubmit = useLastCallback(() => {
    closeAuthBackupWalletModal({ isBackupCreated: true });
  });

  // eslint-disable-next-line consistent-return
  function renderModalContent(isScreenActive: boolean, isFrom: boolean, currentScreenKey: number) {
    switch (currentScreenKey) {
      case BackupState.Accept:
        return (
          <SafetyRules
            isActive={isScreenActive}
            onSubmit={handleMnemonicView}
            onClose={closeAuthBackupWalletModal}
          />
        );

      case BackupState.View:
        return (
          <MnemonicList
            isActive={isScreenActive}
            mnemonic={mnemonic}
            onNext={handleShowMnemonicCheck}
            onClose={closeAuthBackupWalletModal}
          />
        );

      case BackupState.Confirm:
        return (
          <MnemonicCheck
            isActive={isScreenActive}
            mnemonic={mnemonic}
            checkIndexes={checkIndexes}
            buttonLabel={lang('Continue')}
            onSubmit={handleMnemonicCheckSubmit}
            onCancel={handleRestartCheckMnemonic}
            onClose={closeAuthBackupWalletModal}
          />
        );
    }
  }
  return (
    <Modal
      hasCloseButton
      isOpen={isOpen}
      dialogClassName={styles.modalDialog}
      nativeBottomSheetKey="disclaimer"
      onClose={closeAuthBackupWalletModal}
      onCloseAnimationEnd={handleModalClose}
    >
      <Transition
        name={resolveModalTransitionName()}
        className={modalStyles.transition}
        slideClassName={modalStyles.transitionSlide}
        activeKey={renderingKey}
        nextKey={nextKey}
      >
        {renderModalContent}
      </Transition>
    </Modal>
  );
}

export default memo(AuthBackupWalletModal);

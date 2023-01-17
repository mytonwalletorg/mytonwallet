import React, {
  memo, useCallback, useEffect, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import buildClassName from '../../../util/buildClassName';
import { selectMnemonicForCheck } from '../../../global/actions/api/auth';
import { selectCurrentAccountState } from '../../../global/selectors';
import useLang from '../../../hooks/useLang';

import Modal from '../../ui/Modal';
import ModalHeader from '../../ui/ModalHeader';
import PasswordForm from '../../ui/PasswordForm';
import SafetyRules from '../../auth/SafetyRules';
import MnemonicList from '../../auth/MnemonicList';
import MnemonicCheck from '../../auth/MnemonicCheck';
import Transition from '../../ui/Transition';

import styles from './BackupModal.module.scss';
import modalStyles from '../../ui/Modal.module.scss';

type OwnProps = {
  isOpen: boolean;
  onClose: () => void;
};

type StateProps = {
  isLoading?: boolean;
  mnemonic?: string[];
  error?: string;
};

enum SLIDES {
  confirm,
  password,
  mnemonic,
  check,
}

function BackupModal({
  isOpen, onClose, isLoading, mnemonic, error,
}: OwnProps & StateProps) {
  const { startBackupWallet, cleanBackupWalletError, closeBackupWallet } = getActions();

  const lang = useLang();
  const [currentSlide, setCurrentSlide] = useState<number>(SLIDES.confirm);
  const [nextKey, setNextKey] = useState<number | undefined>(SLIDES.password);
  const [checkIndexes, setCheckIndexes] = useState<number[]>([]);

  useEffect(() => {
    if (mnemonic?.length && currentSlide === SLIDES.password) {
      setNextKey(SLIDES.check);
      setCurrentSlide(SLIDES.mnemonic);
    }
  }, [currentSlide, mnemonic?.length]);

  const handleSafetyConfirm = useCallback(() => {
    setCurrentSlide(SLIDES.password);
    setNextKey(SLIDES.mnemonic);
  }, []);

  const handlePasswordSubmit = useCallback((password: string) => {
    startBackupWallet({ password });
  }, [startBackupWallet]);

  const handleCheckMnemonic = useCallback(() => {
    setCheckIndexes(selectMnemonicForCheck());
    setCurrentSlide(SLIDES.check);
    setNextKey(undefined);
  }, []);

  const handleRestartCheckMnemonic = useCallback(() => {
    setCurrentSlide(SLIDES.mnemonic);
    setNextKey(SLIDES.check);
  }, []);

  const handleModalClose = useCallback(() => {
    closeBackupWallet();
    setCurrentSlide(SLIDES.confirm);
    setNextKey(SLIDES.password);
  }, [closeBackupWallet]);

  const handleCheckMnemonicSubmit = useCallback(() => {
    closeBackupWallet({ isMnemonicChecked: true });
    onClose();
  }, [closeBackupWallet, onClose]);

  // eslint-disable-next-line consistent-return
  function renderContent(isActive: boolean, isFrom: boolean, currentKey: number) {
    switch (currentKey) {
      case SLIDES.confirm:
        return (
          <SafetyRules
            isActive={isActive}
            onSubmit={handleSafetyConfirm}
            onClose={onClose}
          />
        );

      case SLIDES.password:
        return (
          <>
            <ModalHeader title={lang('Enter Password')} onClose={onClose} />
            <PasswordForm
              isActive={isActive}
              isLoading={isLoading}
              error={error}
              placeholder={lang('Enter your password')}
              submitLabel={lang('Back Up')}
              onCleanError={cleanBackupWalletError}
              onSubmit={handlePasswordSubmit}
              cancelLabel={lang('Cancel')}
              onCancel={onClose}
            />
          </>
        );

      case SLIDES.mnemonic:
        return (
          <MnemonicList
            mnemonic={mnemonic}
            onNext={handleCheckMnemonic}
            onClose={onClose}
          />
        );

      case SLIDES.check:
        return (
          <MnemonicCheck
            isActive={isActive}
            isInModal
            mnemonic={mnemonic}
            checkIndexes={checkIndexes}
            buttonLabel={lang('Done')}
            onSubmit={handleCheckMnemonicSubmit}
            onCancel={handleRestartCheckMnemonic}
            onClose={onClose}
          />
        );
    }
  }

  return (
    <Modal
      hasCloseButton
      isSlideUp
      isOpen={isOpen}
      onClose={onClose}
      onCloseAnimationEnd={handleModalClose}
      dialogClassName={styles.modalDialog}
    >
      <Transition
        name="push-slide"
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
  const { isLoading, mnemonic, error } = selectCurrentAccountState(global)?.backupWallet || {};

  return { isLoading, mnemonic, error };
})(BackupModal));

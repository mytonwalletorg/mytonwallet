import React, { memo, useCallback, useState } from '../../lib/teact/teact';
import { getActions } from '../../global';

import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';
import buildClassName from '../../util/buildClassName';
import useFlag from '../../hooks/useFlag';

import Transition from '../ui/Transition';
import AnimatedIcon from '../ui/AnimatedIcon';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import SafetyRules from './SafetyRules';
import MnemonicList from './MnemonicList';
import MnemonicCheck from './MnemonicCheck';

import styles from './Auth.module.scss';
import modalStyles from '../ui/Modal.module.scss';

interface OwnProps {
  isActive?: boolean;
  mnemonic?: string[];
  checkIndexes?: number[];
}

enum BackupState {
  Accept,
  View,
  Confirm,
}

const SLIDE_ANIMATION_DURATION_MS = 250;

const AuthCreateBackup = ({ isActive, mnemonic, checkIndexes }: OwnProps) => {
  const { afterCheckMnemonic, skipCheckMnemonic, restartCheckMnemonicIndexes } = getActions();

  const [isModalOpen, openModal, closeModal] = useFlag();

  const [renderingKey, setRenderingKey] = useState<number>(BackupState.Accept);
  const [nextKey, setNextKey] = useState<number | undefined>(BackupState.View);

  const handleCloseModal = useCallback(() => {
    setRenderingKey(BackupState.Accept);
    setNextKey(BackupState.View);
  }, []);

  const handleMnemonicView = useCallback(() => {
    setRenderingKey(BackupState.View);
    setNextKey(BackupState.Confirm);
  }, []);

  const handleRestartCheckMnemonic = useCallback(() => {
    handleMnemonicView();

    setTimeout(() => {
      restartCheckMnemonicIndexes();
    }, SLIDE_ANIMATION_DURATION_MS);
  }, [handleMnemonicView, restartCheckMnemonicIndexes]);

  const handleShowMnemonicCheck = useCallback(() => {
    setRenderingKey(BackupState.Confirm);
    setNextKey(undefined);
  }, []);

  const handleMnemonicCheckSubmit = useCallback(() => {
    closeModal();
    afterCheckMnemonic();
  }, [afterCheckMnemonic, closeModal]);

  // eslint-disable-next-line consistent-return
  function renderModalContent(isScreenActive: boolean, isFrom: boolean, currentScreenKey: number) {
    switch (currentScreenKey) {
      case BackupState.Accept:
        return <SafetyRules isActive={isScreenActive} onSubmit={handleMnemonicView} onClose={closeModal} />;

      case BackupState.View:
        return (
          <MnemonicList
            mnemonic={mnemonic}
            onNext={handleShowMnemonicCheck}
            onClose={closeModal}
          />
        );

      case BackupState.Confirm:
        return (
          <MnemonicCheck
            isActive={isScreenActive}
            mnemonic={mnemonic}
            checkIndexes={checkIndexes}
            buttonLabel="Continue"
            onSubmit={handleMnemonicCheckSubmit}
            onCancel={handleRestartCheckMnemonic}
            onClose={closeModal}
          />
        );
    }
  }

  return (
    <>
      <div className={buildClassName(styles.container, 'custom-scroll')}>
        <AnimatedIcon
          play={isActive && !isModalOpen}
          tgsUrl={ANIMATED_STICKERS_PATHS.snitch}
          noLoop={false}
          nonInteractive
          className={styles.sticker}
        />
        <div className={styles.title}>Create Backup</div>
        <div className={styles.info}>
          <p className={styles.info__space}>
            This is a <strong>secure wallet</strong>
            <br />and is only <strong>controlled by you</strong>.
          </p>

          <p>
            And with great power comes <strong>great responsibility</strong>.
          </p>
          <p>
            You need to manually <strong>back&nbsp;up secret keys</strong> in case you forget
            your password or lose access to this device.
          </p>
        </div>
        <div className={styles.buttons}>
          <Button isPrimary className={styles.btn} onClick={openModal}>
            Back up
          </Button>
          <Button isDestructive className={buildClassName(styles.btn, styles.btn_push)} onClick={skipCheckMnemonic}>
            Skip for now
          </Button>
        </div>
      </div>

      <Modal
        hasCloseButton
        isSlideUp
        isOpen={isModalOpen}
        onClose={closeModal}
        onCloseAnimationEnd={handleCloseModal}
        dialogClassName={styles.modalDialog}
      >
        <Transition
          name="push-slide"
          className={modalStyles.transition}
          slideClassName={modalStyles.transitionSlide}
          activeKey={renderingKey}
          nextKey={nextKey}
        >
          {renderModalContent}
        </Transition>
      </Modal>
    </>
  );
};

export default memo(AuthCreateBackup);

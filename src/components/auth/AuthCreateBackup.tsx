import React, { memo, useState } from '../../lib/teact/teact';

import { getActions } from '../../global';
import renderText from '../../global/helpers/renderText';
import buildClassName from '../../util/buildClassName';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import Transition from '../ui/Transition';
import MnemonicCheck from './MnemonicCheck';
import MnemonicList from './MnemonicList';
import SafetyRules from './SafetyRules';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Auth.module.scss';

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

  const lang = useLang();
  const [isModalOpen, openModal, closeModal] = useFlag();

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
    closeModal();
    afterCheckMnemonic();
  });

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
            buttonLabel={lang('Continue')}
            onSubmit={handleMnemonicCheckSubmit}
            onCancel={handleRestartCheckMnemonic}
            onClose={closeModal}
          />
        );
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={buildClassName(styles.container, 'custom-scroll')}>
        <AnimatedIconWithPreview
          play={isActive && !isModalOpen}
          tgsUrl={ANIMATED_STICKERS_PATHS.snitch}
          previewUrl={ANIMATED_STICKERS_PATHS.snitchPreview}
          noLoop={false}
          nonInteractive
          className={styles.sticker}
        />
        <div className={styles.title}>{lang('Create Backup')}</div>
        <div className={styles.info}>
          <p className={styles.info__space}>{renderText(lang('$auth_backup_description1'))}</p>
          <p>{renderText(lang('$auth_backup_description2'))}</p>
          <p>{renderText(lang('$auth_backup_description3'))}</p>
        </div>
        <div className={styles.buttons}>
          <Button isPrimary className={styles.btn} onClick={openModal}>
            {lang('Back Up')}
          </Button>
          <Button
            isDestructive
            isText
            className={buildClassName(styles.btn, styles.btn_push)}
            onClick={skipCheckMnemonic}
          >
            {lang('Later')}
          </Button>
        </div>
      </div>

      <Modal
        hasCloseButton
        isOpen={isModalOpen}
        onClose={closeModal}
        onCloseAnimationEnd={handleModalClose}
        dialogClassName={styles.modalDialog}
      >
        <Transition
          name="pushSlide"
          className={modalStyles.transition}
          slideClassName={modalStyles.transitionSlide}
          activeKey={renderingKey}
          nextKey={nextKey}
        >
          {renderModalContent}
        </Transition>
      </Modal>
    </div>
  );
};

export default memo(AuthCreateBackup);

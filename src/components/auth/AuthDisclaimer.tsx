import React, { memo, useState } from '../../lib/teact/teact';

import { ANIMATED_STICKER_MIDDLE_SIZE_PX } from '../../config';
import { getActions } from '../../global';
import renderText from '../../global/helpers/renderText';
import buildClassName from '../../util/buildClassName';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useShowTransition from '../../hooks/useShowTransition';

import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import Button from '../ui/Button';
import Checkbox from '../ui/Checkbox';
import Modal from '../ui/Modal';
import Transition from '../ui/Transition';
import MnemonicCheck from './MnemonicCheck';
import MnemonicList from './MnemonicList';
import SafetyRules from './SafetyRules';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Auth.module.scss';

interface OwnProps {
  isActive?: boolean;
  isImport?: boolean;
  mnemonic?: string[];
  checkIndexes?: number[];
}

enum BackupState {
  Accept,
  View,
  Confirm,
}

const SLIDE_ANIMATION_DURATION_MS = 250;

const AuthDisclaimer = ({
  isActive, isImport, mnemonic, checkIndexes,
}: OwnProps) => {
  const {
    afterCheckMnemonic,
    skipCheckMnemonic,
    restartCheckMnemonicIndexes,
    confirmDisclaimer,
  } = getActions();

  const lang = useLang();
  const [isModalOpen, openModal, closeModal] = useFlag();
  const [isInformationConfirmed, setIsInformationConfirmed] = useState(false);
  const {
    shouldRender: shouldRenderStartButton,
    transitionClassNames: startButtonTransitionClassNames,
  } = useShowTransition(isInformationConfirmed && isImport);

  const [renderingKey, setRenderingKey] = useState<number>(BackupState.Accept);
  const [nextKey, setNextKey] = useState<number | undefined>(BackupState.View);

  const handleCloseBackupWarningModal = useLastCallback(() => {
    setIsInformationConfirmed(false);
  });

  const handleSkipMnemonic = useLastCallback(() => {
    skipCheckMnemonic();
    handleCloseBackupWarningModal();
  });

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
    // Don't flicker the backup notice modal after submitting a mnemonic
    setIsInformationConfirmed(false);
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
        <div className={styles.stickerAndTitle}>
          <AnimatedIconWithPreview
            play={isActive && !isModalOpen}
            tgsUrl={ANIMATED_STICKERS_PATHS.snitch}
            previewUrl={ANIMATED_STICKERS_PATHS.snitchPreview}
            noLoop={false}
            nonInteractive
            size={ANIMATED_STICKER_MIDDLE_SIZE_PX}
            className={styles.sticker}
          />
          <div className={styles.title}>{lang('Use Responsibly')}</div>
        </div>
        <div className={styles.infoBlock}>
          <p className={styles.text}>{renderText(lang('$auth_responsibly_description1'))}</p>
          <p className={styles.text}>{renderText(lang('$auth_responsibly_description2'))}</p>
          <p className={styles.text}>{renderText(lang('$auth_responsibly_description3'))}</p>
          <p className={styles.text}>{renderText(lang('$auth_responsibly_description4'))}</p>
        </div>

        <Checkbox
          id="information-confirmed"
          checked={isInformationConfirmed}
          onChange={setIsInformationConfirmed}
          className={styles.informationCheckbox}
          contentClassName={styles.informationCheckboxContent}
        >
          {lang('I have read and accept this information')}
        </Checkbox>
        {shouldRenderStartButton && (
          <div className={buildClassName(styles.buttons, startButtonTransitionClassNames)}>
            <Button isPrimary className={buildClassName(styles.btn, styles.btn_wide)} onClick={confirmDisclaimer}>
              {lang('Start Wallet')}
            </Button>
          </div>
        )}
      </div>

      <Modal
        isOpen={isInformationConfirmed && !isImport && !isModalOpen}
        onClose={handleCloseBackupWarningModal}
        dialogClassName={styles.disclaimerBackupDialog}
      >
        <p className={styles.backupNotice}>{renderText(lang('$auth_backup_warning_notice'))}</p>
        <div className={styles.backupNoticeButtons}>
          <Button isPrimary className={buildClassName(styles.btn, styles.btn_wide)} onClick={openModal}>
            {lang('Back Up Now')}
          </Button>
          <Button
            isDestructive
            className={buildClassName(styles.btn, styles.btn_mini)}
            onClick={handleSkipMnemonic}
          >
            {lang('Later')}
          </Button>
        </div>
      </Modal>

      <Modal
        hasCloseButton
        isOpen={isModalOpen}
        onClose={closeModal}
        onCloseAnimationEnd={handleModalClose}
        dialogClassName={styles.modalDialog}
      >
        <Transition
          name="slideLayers"
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

export default memo(AuthDisclaimer);

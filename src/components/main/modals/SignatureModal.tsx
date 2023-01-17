import React, {
  memo, useCallback, useEffect, useLayoutEffect, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { ANIMATED_STICKERS_PATHS } from '../../ui/helpers/animatedAssets';
import renderText from '../../../global/helpers/renderText';
import buildClassName from '../../../util/buildClassName';
import captureKeyboardListeners from '../../../util/captureKeyboardListeners';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';

import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import Transition from '../../ui/Transition';
import ModalHeader from '../../ui/ModalHeader';
import PasswordForm from '../../ui/PasswordForm';
import AnimatedIconWithPreview from '../../ui/AnimatedIconWithPreview';

import styles from './SignatureModal.module.scss';
import transferStyles from '../../transfer/Transfer.module.scss';
import modalStyles from '../../ui/Modal.module.scss';

type StateProps = {
  dataHex?: string;
  error?: string;
  isSigned?: boolean;
};

const enum SLIDES {
  confirm,
  password,
  complete,
}

function SignatureModal({
  dataHex, error, isSigned,
}: StateProps) {
  const { submitSignature, cleanSignatureError, cancelSignature } = getActions();

  const lang = useLang();
  const [isModalOpen, openModal, closeModal] = useFlag(false);
  const [currentSlide, setCurrentSlide] = useState<number>(SLIDES.confirm);
  const [nextKey, setNextKey] = useState<number | undefined>(SLIDES.password);

  useLayoutEffect(() => {
    if (dataHex) {
      setCurrentSlide(SLIDES.confirm);
      setNextKey(SLIDES.password);
      openModal();
    }
  }, [dataHex, openModal]);

  useLayoutEffect(() => {
    if (isSigned) {
      setCurrentSlide(SLIDES.complete);
      setNextKey(undefined);
    }
  }, [isSigned]);

  useEffect(() => (
    currentSlide === SLIDES.complete
      ? captureKeyboardListeners({
        onEnter: () => {
          closeModal();
        },
      })
      : undefined
  ), [closeModal, currentSlide]);

  const handleConfirm = useCallback(() => {
    setCurrentSlide(SLIDES.password);
    setNextKey(SLIDES.complete);
  }, []);

  const handlePasswordSubmit = useCallback((password: string) => {
    submitSignature({ password });
  }, [submitSignature]);

  function renderConfirm() {
    return (
      <>
        <ModalHeader title={lang('Confirmation')} onClose={closeModal} />
        <div className={modalStyles.transitionContent}>
          <div className={transferStyles.label}>{lang('Data to sign')}</div>
          <div className={transferStyles.inputReadOnly}>
            {dataHex}
          </div>

          <div className={styles.error}>
            {renderText(lang('$signature_warning'))}
          </div>
          <div className={modalStyles.buttons}>
            <Button onClick={closeModal}>{lang('Cancel')}</Button>
            <Button isPrimary onClick={handleConfirm}>{lang('Sign')}</Button>
          </div>
        </div>
      </>
    );
  }

  function renderPasswordForm(isActive: boolean) {
    return (
      <>
        <ModalHeader title={lang('Enter Password')} onClose={closeModal} />
        <PasswordForm
          isActive={isActive}
          error={error}
          placeholder={lang('Enter your password')}
          submitLabel={lang('Sign')}
          onCleanError={cleanSignatureError}
          onSubmit={handlePasswordSubmit}
          cancelLabel="Cancel"
          onCancel={closeModal}
        />
      </>
    );
  }

  function renderComplete(isActive: boolean) {
    return (
      <>
        <ModalHeader title={lang('Done!')} onClose={closeModal} />

        <div className={buildClassName(modalStyles.transitionContent, modalStyles.transitionContent_simple)}>
          <AnimatedIconWithPreview
            play={isActive}
            noLoop={false}
            nonInteractive
            className={styles.sticker}
            tgsUrl={ANIMATED_STICKERS_PATHS.thumbUp}
            previewUrl={ANIMATED_STICKERS_PATHS.thumbUpPreview}
          />
          <div className={styles.description}>
            {lang('Signing was confirmed!')}
          </div>

          <div className={modalStyles.buttons}>
            <Button isPrimary onClick={closeModal}>{lang('Close')}</Button>
          </div>
        </div>
      </>
    );
  }
  // eslint-disable-next-line consistent-return
  function renderContent(isActive: boolean, isFrom: boolean, currentKey: number) {
    switch (currentKey) {
      case SLIDES.confirm:
        return renderConfirm();

      case SLIDES.password:
        return renderPasswordForm(isActive);

      case SLIDES.complete:
        return renderComplete(isActive);
    }
  }

  return (
    <Modal
      isSlideUp
      hasCloseButton
      isOpen={isModalOpen}
      onClose={closeModal}
      onCloseAnimationEnd={cancelSignature}
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

export default memo(withGlobal(
  (global): StateProps => {
    const {
      dataHex, error, isSigned,
    } = global.currentSignature || {};

    return {
      dataHex, error, isSigned,
    };
  },
)(SignatureModal));

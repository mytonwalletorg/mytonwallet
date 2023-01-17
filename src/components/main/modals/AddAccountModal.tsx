import React, { memo, useCallback, useState } from '../../../lib/teact/teact';
import { withGlobal, getActions } from '../../../global';

import { ANIMATED_STICKER_BIG_SIZE_PX, MNEMONIC_COUNT } from '../../../config';
import { ANIMATED_STICKERS_PATHS } from '../../ui/helpers/animatedAssets';
import renderText from '../../../global/helpers/renderText';
import buildClassName from '../../../util/buildClassName';
import useLang from '../../../hooks/useLang';

import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import AnimatedIconWithPreview from '../../ui/AnimatedIconWithPreview';
import Transition from '../../ui/Transition';
import ModalHeader from '../../ui/ModalHeader';
import PasswordForm from '../../ui/PasswordForm';

import styles from './AddAccountModal.module.scss';
import modalStyles from '../../ui/Modal.module.scss';

interface StateProps {
  isOpen?: boolean;
  isLoading?: boolean;
  error?: string;
}

const enum RenderingState {
  initial,
  password,
}

function AddAccountModal({
  isOpen,
  isLoading,
  error,
}: StateProps) {
  const { addAccount, cleanAccountError, closeAddAccountModal } = getActions();

  const lang = useLang();
  const [renderingKey, setRenderingKey] = useState<number>(RenderingState.initial);

  const [isNewAccountImporting, setIsNewAccountImporting] = useState<boolean>(false);

  const handleBackClick = useCallback(() => {
    setRenderingKey(RenderingState.initial);
  }, []);

  const handleModalClose = useCallback(() => {
    setRenderingKey(RenderingState.initial);
    setIsNewAccountImporting(false);
  }, []);

  const handleNewAccountClick = useCallback(() => {
    setRenderingKey(RenderingState.password);
    setIsNewAccountImporting(false);
  }, []);

  const handleImportAccountClick = useCallback(() => {
    setRenderingKey(RenderingState.password);
    setIsNewAccountImporting(true);
  }, []);

  const handleSubmit = useCallback((password: string) => {
    addAccount({ isImporting: isNewAccountImporting, password });
  }, [addAccount, isNewAccountImporting]);

  function renderSelector(isActive?: boolean) {
    return (
      <>
        <ModalHeader title={lang('Add Wallet')} onClose={closeAddAccountModal} />
        <AnimatedIconWithPreview
          size={ANIMATED_STICKER_BIG_SIZE_PX}
          play={isActive}
          noLoop={false}
          nonInteractive
          className={styles.sticker}
          tgsUrl={ANIMATED_STICKERS_PATHS.forge}
          previewUrl={ANIMATED_STICKERS_PATHS.forgePreview}
        />
        <p className={styles.modalText}>
          {renderText(lang('$add_account_description1'))}
        </p>
        <p className={styles.modalText}>
          {renderText(lang('$add_account_description2'))}
        </p>

        <div className={styles.modalButtons}>
          <Button isPrimary onClick={handleNewAccountClick}>{lang('Create New Wallet')}</Button>
          <Button isText onClick={handleImportAccountClick}>
            {lang('Import From %1$d Secret Words', MNEMONIC_COUNT)}
          </Button>
        </div>
      </>
    );
  }

  function renderPassword(isActive: boolean) {
    return (
      <>
        <ModalHeader title={lang('Enter Password')} onClose={closeAddAccountModal} />
        <PasswordForm
          isActive={isActive}
          isLoading={isLoading}
          error={error}
          placeholder={lang('Enter your password')}
          onCleanError={cleanAccountError}
          onSubmit={handleSubmit}
          submitLabel={lang('Send')}
          onCancel={handleBackClick}
          cancelLabel={lang('Back')}
        />
      </>
    );
  }

  // eslint-disable-next-line consistent-return
  function renderContent(isActive: boolean, isFrom: boolean, currentKey: number) {
    switch (currentKey) {
      case RenderingState.initial:
        return renderSelector(isActive);

      case RenderingState.password:
        return renderPassword(isActive);
    }
  }

  return (
    <Modal
      hasCloseButton
      isSlideUp
      isOpen={isOpen}
      onClose={closeAddAccountModal}
      noBackdropClose
      onCloseAnimationEnd={handleModalClose}
      dialogClassName={styles.modalDialog}
    >
      <Transition
        name="push-slide"
        className={buildClassName(modalStyles.transition, 'custom-scroll')}
        slideClassName={modalStyles.transitionSlide}
        activeKey={renderingKey}
        nextKey={renderingKey === RenderingState.initial ? RenderingState.password : undefined}
      >
        {renderContent}
      </Transition>
    </Modal>
  );
}

export default memo(withGlobal((global): StateProps => {
  return {
    isOpen: global.isAddAccountModalOpen,
    isLoading: global.accounts?.isLoading,
    error: global.accounts?.error,
  };
})(AddAccountModal));

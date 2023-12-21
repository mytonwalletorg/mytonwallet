import React, { memo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { AuthMethod } from '../../global/types';

import { ANIMATED_STICKER_HUGE_SIZE_PX } from '../../config';
import buildClassName from '../../util/buildClassName';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';
import { getFormId } from './helpers/getFormId';

import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useFlag from '../../hooks/useFlag';
import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useShowTransition from '../../hooks/useShowTransition';

import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import Button from '../ui/Button';
import CreatePasswordForm from '../ui/CreatePasswordForm';
import Modal from '../ui/Modal';

import styles from './Auth.module.scss';

interface OwnProps {
  isActive?: boolean;
  method?: AuthMethod;
  isLoading?: boolean;
  error?: string;
  biometricsStep?: 1 | 2;
}

const AuthCreateBiometrics = ({
  isActive,
  method,
  biometricsStep,
  error,
  isLoading,
}: OwnProps) => {
  const { afterCreatePassword, afterCreateBiometrics, restartAuth } = getActions();

  const lang = useLang();
  const [isPasswordModalOpen, openPasswordModal, closePasswordModal] = useFlag(false);
  const isImporting = method !== 'createAccount';
  const formId = getFormId(method!);
  const {
    shouldRender: shouldRenderSteps,
    transitionClassNames: stepsClassNames,
  } = useShowTransition(Boolean(biometricsStep));
  const {
    shouldRender: shouldRenderError,
    transitionClassNames: errorClassNames,
  } = useShowTransition(Boolean(error && !shouldRenderSteps));
  const renderingError = useCurrentOrPrev(error, true);

  useHistoryBack({
    isActive,
    onBack: restartAuth,
  });

  const handleSubmit = useLastCallback((password: string, isPasswordNumeric: boolean) => {
    closePasswordModal();
    afterCreatePassword({ password, isPasswordNumeric });
  });

  return (
    <>
      <div className={buildClassName(styles.container, styles.container_scrollable, 'custom-scroll')}>
        <AnimatedIconWithPreview
          play={isActive && !isPasswordModalOpen}
          tgsUrl={ANIMATED_STICKERS_PATHS.happy}
          previewUrl={ANIMATED_STICKERS_PATHS.happyPreview}
          noLoop={false}
          nonInteractive
          className={styles.sticker}
        />
        <div className={styles.title}>{lang('Congratulations!')}</div>
        <p className={styles.info}>
          <b>{lang(isImporting ? 'The wallet is imported' : 'The wallet is ready')}.</b>
        </p>
        <p className={styles.info}>
          {lang('Create a password or use biometric authentication to protect it.')}
        </p>

        {shouldRenderSteps && (
          <div className={buildClassName(styles.biometricsStep, stepsClassNames)}>
            {lang(biometricsStep === 1 ? 'Step 1 of 2. Registration' : 'Step 2 of 2. Verification')}
          </div>
        )}
        {shouldRenderError && !shouldRenderSteps && (
          <div className={buildClassName(styles.biometricsError, errorClassNames)}>
            {lang(renderingError || 'Unknown error')}
          </div>
        )}

        <div className={styles.buttons}>
          <Button
            isPrimary
            className={styles.btn}
            isDisabled={Boolean(biometricsStep) || isLoading}
            onClick={afterCreateBiometrics}
          >
            {lang('Connect Biometrics')}
          </Button>
          <Button
            isText
            className={buildClassName(styles.btn, styles.btn_text)}
            isDisabled={Boolean(biometricsStep) || isLoading}
            onClick={openPasswordModal}
          >
            {lang('Use Password')}
          </Button>
        </div>
      </div>

      <Modal
        isOpen={isPasswordModalOpen}
        title={lang('Create Password')}
        hasCloseButton
        contentClassName={styles.passwordFormContainer}
        onClose={closePasswordModal}
      >
        <AnimatedIconWithPreview
          play={isActive && isPasswordModalOpen}
          tgsUrl={ANIMATED_STICKERS_PATHS.guard}
          previewUrl={ANIMATED_STICKERS_PATHS.guardPreview}
          size={ANIMATED_STICKER_HUGE_SIZE_PX}
          noLoop={false}
          nonInteractive
        />
        <CreatePasswordForm
          isActive={isActive && isPasswordModalOpen}
          isLoading={isLoading}
          formId={formId}
          onCancel={closePasswordModal}
          onSubmit={handleSubmit}
        />
      </Modal>
    </>
  );
};

export default memo(AuthCreateBiometrics);

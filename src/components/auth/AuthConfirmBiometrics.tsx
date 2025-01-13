import React, { memo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import buildClassName from '../../util/buildClassName';
import { SECOND } from '../../util/dateFormat';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';

import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';
import useTimeout from '../../hooks/useTimeout';

import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import Button from '../ui/Button';

import styles from './Auth.module.scss';

interface OwnProps {
  isActive?: boolean;
  isLoading?: boolean;
  error?: string;
  biometricsStep?: 1 | 2;
}

const START_BIOMETRICS_CONFIRMATION_DELAY_MS = SECOND;

function AuthConfirmBiometrics({
  isActive,
  biometricsStep,
  error,
  isLoading,
}: OwnProps) {
  const {
    afterCreateBiometrics,
    resetAuth,
    cancelCreateBiometrics,
  } = getActions();

  useTimeout(afterCreateBiometrics, isActive ? START_BIOMETRICS_CONFIRMATION_DELAY_MS : undefined, [isActive]);

  const lang = useLang();
  const shouldRenderSteps = Boolean(biometricsStep);
  const shouldRenderError = Boolean(error && !shouldRenderSteps);
  const renderingError = useCurrentOrPrev(error, true);

  useHistoryBack({
    isActive,
    onBack: resetAuth,
  });

  return (
    <div className={buildClassName(styles.container, styles.container_scrollable, 'custom-scroll')}>
      <AnimatedIconWithPreview
        play={isActive}
        tgsUrl={ANIMATED_STICKERS_PATHS.guard}
        previewUrl={ANIMATED_STICKERS_PATHS.guardPreview}
        noLoop={false}
        nonInteractive
        className={styles.sticker}
      />
      <div className={styles.title}>{lang('Turn On Biometrics')}</div>

      {shouldRenderSteps && (
        <div className={styles.biometricsStep}>
          {lang(biometricsStep === 1 ? 'Step 1 of 2. Registration' : 'Step 2 of 2. Verification')}
        </div>
      )}
      {shouldRenderError && (
        <div className={buildClassName(styles.biometricsError)}>
          <div>{lang(renderingError || 'Unknown error')}</div>
          <div>{lang('Please try to confirm your biometrics again')}</div>
        </div>
      )}

      <div className={styles.buttons}>
        <div className={styles.buttons__inner}>
          <Button
            isDisabled={Boolean(biometricsStep) || isLoading}
            className={buildClassName(styles.btn, styles.btnHalfWidth)}
            onClick={cancelCreateBiometrics}
          >
            {lang('Cancel')}
          </Button>

          {shouldRenderError && (
            <Button
              isPrimary
              className={buildClassName(styles.btn, styles.btnHalfWidth)}
              isDisabled={Boolean(biometricsStep) || isLoading}
              onClick={afterCreateBiometrics}
            >
              {lang('Try Again')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(AuthConfirmBiometrics);

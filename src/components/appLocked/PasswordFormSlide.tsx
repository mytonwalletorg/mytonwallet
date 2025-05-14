import type { RefObject } from 'react';
import React, { memo, useState } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { Theme } from '../../global/types';

import { APP_NAME } from '../../config';
import { getDoesUsePinPad, getIsNativeBiometricAuthSupported } from '../../util/biometrics';
import buildClassName from '../../util/buildClassName';
import { vibrateOnSuccess } from '../../util/haptics';
import { callApi } from '../../api';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import PasswordForm from '../ui/PasswordForm';
import Logo from './Logo';

import styles from './AppLocked.module.scss';

interface OwnProps {
  isActive: boolean;
  theme: Theme;
  shouldHideBiometrics?: boolean;
  ref: RefObject<HTMLDivElement>;
  positionTop: number;
  isFullHeight: boolean;
  isWrapperFixed: boolean;
  onSubmit: NoneToVoidFunction;
}

const PINPAD_RESET_DELAY = 300;

function PasswordFormSlide({
  isActive,
  theme,
  ref,
  shouldHideBiometrics,
  positionTop,
  isFullHeight,
  isWrapperFixed,
  onSubmit,
}: OwnProps) {
  const { setIsPinAccepted } = getActions();

  const lang = useLang();
  const [passwordError, setPasswordError] = useState('');

  const handleSubmitPassword = useLastCallback(async (password: string) => {
    const result = await callApi('verifyPassword', password);

    if (!result) {
      setPasswordError('Wrong password, please try again.');
      return;
    }

    if (getDoesUsePinPad()) {
      setIsPinAccepted();
      await vibrateOnSuccess(true);
    }
    onSubmit();
  });

  const handlePasswordChange = useLastCallback(() => setPasswordError(''));

  return (
    <div
      ref={ref}
      className={buildClassName(
        styles.passwordFormWrapper,
        isActive && styles.passwordFormWrapperActive,
        isWrapperFixed && styles.passwordFormWrapperFixed,
        isFullHeight && getDoesUsePinPad() && styles.passwordFormWrapperFullHeight,
      )}
      style={`--position-top: ${positionTop}px;`}
    >
      <PasswordForm
        isActive={!isActive ? false : getIsNativeBiometricAuthSupported() ? !shouldHideBiometrics : true}
        noAnimatedIcon
        forceBiometricsInMain
        error={passwordError}
        resetStateDelayMs={PINPAD_RESET_DELAY}
        operationType="unlock"
        containerClassName={styles.passwordFormContent}
        inputWrapperClassName={styles.passwordInputWrapper}
        submitLabel={lang('Unlock')}
        onSubmit={handleSubmitPassword}
        onUpdate={handlePasswordChange}
      >
        <Logo theme={theme} />
        <span className={buildClassName(styles.title, 'rounded-font')}>{APP_NAME}</span>
      </PasswordForm>
    </div>
  );
}

export default memo(PasswordFormSlide);

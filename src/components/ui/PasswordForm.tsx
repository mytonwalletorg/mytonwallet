import type { TeactNode } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { AuthConfig } from '../../util/authApi/types';

import { IS_CAPACITOR, PIN_LENGTH } from '../../config';
import authApi from '../../util/authApi';
import buildClassName from '../../util/buildClassName';
import { getIsFaceIdAvailable, getIsTouchIdAvailable } from '../../util/capacitor';
import captureKeyboardListeners from '../../util/captureKeyboardListeners';
import { pause } from '../../util/schedulers';
import { IS_ANDROID_APP, IS_DELEGATING_BOTTOM_SHEET } from '../../util/windowEnvironment';
import { ANIMATED_STICKERS_PATHS } from './helpers/animatedAssets';

import { useDeviceScreen } from '../../hooks/useDeviceScreen';
import useFlag from '../../hooks/useFlag';
import useFocusAfterAnimation from '../../hooks/useFocusAfterAnimation';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import AnimatedIconWithPreview from './AnimatedIconWithPreview';
import Button from './Button';
import Input from './Input';
import Modal from './Modal';
import PinPad from './PinPad';

import modalStyles from './Modal.module.scss';
import styles from './PasswordForm.module.scss';

type OperationType = 'transfer' | 'sending' | 'staking' | 'unstaking' | 'swap' | 'unfreeze' | 'passcode';

interface OwnProps {
  isActive: boolean;
  isLoading?: boolean;
  operationType?: OperationType;
  cancelLabel?: string;
  submitLabel: string | TeactNode[];
  stickerSize?: number;
  placeholder?: string;
  error?: string;
  help?: string;
  containerClassName?: string;
  withCloseButton?: boolean;
  children?: TeactNode;
  onCancel: NoneToVoidFunction;
  onUpdate: NoneToVoidFunction;
  onSubmit: (password: string) => void;
}

interface StateProps {
  isPasswordNumeric?: boolean;
  isBiometricAuthEnabled: boolean;
  isNativeBiometricAuthEnabled: boolean;
  authConfig?: AuthConfig;
}

const STICKER_SIZE = 180;
const APPEAR_ANIMATION_DURATION_MS = 300;

function PasswordForm({
  isActive,
  isLoading,
  operationType,
  isPasswordNumeric,
  isBiometricAuthEnabled,
  isNativeBiometricAuthEnabled,
  authConfig,
  cancelLabel,
  submitLabel,
  stickerSize = STICKER_SIZE,
  placeholder = 'Enter your password',
  error,
  help,
  containerClassName,
  children,
  withCloseButton,
  onUpdate,
  onCancel,
  onSubmit,
}: OwnProps & StateProps) {
  const { openSettings } = getActions();

  const lang = useLang();

  // eslint-disable-next-line no-null/no-null
  const passwordRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState<string>('');
  const [localError, setLocalError] = useState<string>('');
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [isResetBiometricsWarningOpen, openResetBiometricsWarning, closeResetBiometricsWarning] = useFlag(false);
  const { isSmallHeight, isPortrait } = useDeviceScreen();
  const isSubmitDisabled = !password.length;

  useEffect(() => {
    if (isActive) {
      setLocalError('');
      setPassword('');
      setWrongAttempts(0);
    }
  }, [isActive]);

  const handleBiometrics = useLastCallback(async () => {
    try {
      const biometricPassword = await authApi.getPassword(authConfig!);
      if (!biometricPassword) {
        setWrongAttempts(wrongAttempts + 1);
        setLocalError(
          operationType === 'transfer'
            ? 'Declined. Please try to confirm transaction using biometrics again.'
            : 'Declined. Please try to confirm operation using biometrics again.',
        );

        if (IS_ANDROID_APP && wrongAttempts > 2) {
          openResetBiometricsWarning();
        }
      } else {
        onSubmit(biometricPassword);
      }
    } catch (err: any) {
      setLocalError(err.message || lang('Something went wrong.'));
    }
  });

  useEffect(() => {
    if (IS_DELEGATING_BOTTOM_SHEET || !isActive || !isBiometricAuthEnabled) {
      return;
    }

    (async () => {
      await pause(APPEAR_ANIMATION_DURATION_MS);
      void handleBiometrics();
    })();
  }, [handleBiometrics, isActive, isBiometricAuthEnabled]);

  useFocusAfterAnimation(passwordRef, !isActive || isBiometricAuthEnabled);

  const handleClearError = useLastCallback(() => {
    setLocalError('');
    onUpdate();
  });

  const handleOpenSettings = useLastCallback(() => {
    closeResetBiometricsWarning();
    onCancel?.();
    openSettings();
  });

  const handleInput = useLastCallback((value: string) => {
    setPassword(value);
    if (error) {
      onUpdate();
    }
  });

  const handleSubmit = useLastCallback(() => {
    onSubmit(password);
  });

  useEffect(() => {
    return isSubmitDisabled || isLoading
      ? undefined
      : captureKeyboardListeners({ onEnter: handleSubmit });
  }, [handleSubmit, isLoading, isSubmitDisabled]);

  function getPinPadTitle() {
    switch (operationType) {
      case 'unfreeze':
        return 'Confirm Unfreezing';
      case 'passcode':
        return 'Confirm Passcode';
      case 'transfer':
      case 'sending':
        return 'Confirm Sending';
      case 'staking':
        return 'Confirm Staking';
      case 'unstaking':
        return 'Confirm Unstaking';
      case 'swap':
        return 'Confirm Swap';
      default:
        return 'Confirm Action';
    }
  }

  if (IS_CAPACITOR) {
    const hasError = Boolean(localError || error);
    const title = getPinPadTitle();
    const actionName = lang(
      !isNativeBiometricAuthEnabled
        ? 'Enter code'
        : (getIsFaceIdAvailable()
          ? 'Enter code or use Face ID'
          : (getIsTouchIdAvailable()
            ? 'Enter code or use Touch ID'
            : 'Enter code or use biometrics')
        ),
    );

    return (
      <>
        {withCloseButton && (
          <Button
            isRound
            className={buildClassName(modalStyles.closeButton, styles.closeButton)}
            ariaLabel={lang('Close')}
            onClick={onCancel}
          >
            <i className={buildClassName(modalStyles.closeIcon, 'icon-close')} aria-hidden />
          </Button>
        )}
        <div className={styles.pinPadHeader}>
          {isPortrait && (
            <AnimatedIconWithPreview
              play={isActive}
              tgsUrl={ANIMATED_STICKERS_PATHS.guard}
              previewUrl={ANIMATED_STICKERS_PATHS.guardPreview}
              noLoop={false}
              nonInteractive
            />
          )}
          {!isSmallHeight && <div className={styles.title}>{lang(title)}</div>}
          {children}
        </div>

        <PinPad
          isActive={isActive}
          title={lang(hasError ? (localError || error!) : (isSmallHeight ? title : actionName))}
          type={hasError ? 'error' : undefined}
          length={PIN_LENGTH}
          value={password}
          onBiometricsClick={isNativeBiometricAuthEnabled ? handleBiometrics : undefined}
          onChange={setPassword}
          onClearError={handleClearError}
          onSubmit={onSubmit}
        />
      </>
    );
  }

  function renderBiometricPrompt() {
    const renderingError = localError || error;
    if (renderingError) {
      return (
        <div className={styles.error}>{lang(renderingError)}</div>
      );
    }

    return (
      <div className={styles.verify}>
        {lang(operationType === 'transfer'
          ? 'Please confirm transaction using biometrics' : 'Please confirm operation using biometrics')}
      </div>
    );
  }

  function renderPasswordForm() {
    return (
      <>
        <Input
          ref={passwordRef}
          type="password"
          isRequired
          id="first-password"
          inputMode={isPasswordNumeric ? 'numeric' : undefined}
          error={error ? lang(error) : localError}
          placeholder={lang(placeholder)}
          value={password}
          onInput={handleInput}
          maxLength={isPasswordNumeric ? PIN_LENGTH : undefined}
        />
        {localError && (
          <div className={styles.errorMessage}>{lang(localError)}</div>
        )}
        {help && !error && (
          <div className={styles.label}>{help}</div>
        )}
      </>
    );
  }

  return (
    <div className={buildClassName(modalStyles.transitionContent, containerClassName)}>
      <AnimatedIconWithPreview
        tgsUrl={ANIMATED_STICKERS_PATHS.holdTon}
        previewUrl={ANIMATED_STICKERS_PATHS.holdTonPreview}
        play={isActive}
        size={stickerSize}
        nonInteractive
        noLoop={false}
        className={styles.sticker}
      />

      {children}

      {isBiometricAuthEnabled ? renderBiometricPrompt() : renderPasswordForm()}

      <div className={modalStyles.footerButtons}>
        {onCancel && (
          <Button
            onClick={isBiometricAuthEnabled && isLoading ? undefined : onCancel}
            isLoading={isLoading && isBiometricAuthEnabled}
            isDisabled={isLoading && !isBiometricAuthEnabled}
            className={modalStyles.buttonHalfWidth}
          >
            {cancelLabel || lang('Cancel')}
          </Button>
        )}
        {isBiometricAuthEnabled && Boolean(localError) && (
          <Button
            isPrimary
            isLoading={isLoading}
            isDisabled={isLoading}
            onClick={!isLoading ? handleBiometrics : undefined}
            className={modalStyles.buttonHalfWidth}
          >
            {lang('Try Again')}
          </Button>
        )}
        {!isBiometricAuthEnabled && (
          <Button
            isPrimary
            isLoading={isLoading}
            isDisabled={isSubmitDisabled}
            onClick={!isLoading ? handleSubmit : undefined}
            className={modalStyles.buttonHalfWidth}
          >
            {submitLabel || lang('Send')}
          </Button>
        )}
      </div>
      <Modal
        isOpen={isResetBiometricsWarningOpen}
        isCompact
        title={lang('Biometric authentification failed')}
        onClose={closeResetBiometricsWarning}
      >
        <p className={modalStyles.text}>
          {lang('Reinstall biometrics in your device\'s system settings, or use a passcode.')}
        </p>

        <div className={modalStyles.buttons}>
          <Button className={modalStyles.button} onClick={closeResetBiometricsWarning}>{lang('Close')}</Button>
          <Button isPrimary className={modalStyles.button} onClick={handleOpenSettings}>
            {lang('Settings')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const { isPasswordNumeric, authConfig } = global.settings;
  const isBiometricAuthEnabled = !!authConfig && authConfig.kind !== 'password';
  const isNativeBiometricAuthEnabled = !!authConfig && authConfig.kind === 'native-biometrics';

  return {
    isPasswordNumeric,
    isBiometricAuthEnabled,
    isNativeBiometricAuthEnabled,
    authConfig,
  };
})(PasswordForm));

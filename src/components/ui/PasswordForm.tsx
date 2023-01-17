import React, {
  memo, useCallback, useEffect, useRef, useState, VirtualElement,
} from '../../lib/teact/teact';

import { ANIMATED_STICKERS_PATHS } from './helpers/animatedAssets';
import buildClassName from '../../util/buildClassName';
import captureKeyboardListeners from '../../util/captureKeyboardListeners';
import useFocusAfterAnimation from '../../hooks/useFocusAfterAnimation';
import useLang from '../../hooks/useLang';

import AnimatedIconWithPreview from './AnimatedIconWithPreview';
import Button from './Button';
import Input from './Input';

import styles from './PasswordForm.module.scss';
import modalStyles from './Modal.module.scss';

interface OwnProps {
  isActive: boolean;
  isLoading?: boolean;
  cancelLabel?: string;
  submitLabel: string;
  stickerSize?: number;
  placeholder?: string;
  error?: string;
  containerClassName?: string;
  children?: VirtualElement;
  onCancel: NoneToVoidFunction;
  onCleanError: NoneToVoidFunction;
  onSubmit: (password: string) => void;
}

const STICKER_SIZE = 180;

function PasswordForm({
  isActive,
  isLoading,
  cancelLabel,
  submitLabel,
  stickerSize = STICKER_SIZE,
  placeholder,
  error,
  containerClassName,
  children,
  onCleanError,
  onCancel,
  onSubmit,
}: OwnProps) {
  const lang = useLang();

  // eslint-disable-next-line no-null/no-null
  const passwordRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState<string>('');
  const isSubmitDisabled = !password.length;

  useEffect(() => {
    if (isActive) {
      setPassword('');
    }
  }, [isActive]);

  useFocusAfterAnimation({
    isActive,
    ref: passwordRef,
  });

  const handleInput = useCallback((value: string) => {
    setPassword(value);
    if (error) {
      onCleanError();
    }
  }, [error, onCleanError]);

  const handleSubmit = useCallback(() => {
    onSubmit(password);
  }, [onSubmit, password]);

  useEffect(() => {
    return isSubmitDisabled
      ? undefined
      : captureKeyboardListeners({
        onEnter: handleSubmit,
      });
  }, [handleSubmit, isSubmitDisabled]);

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

      <Input
        ref={passwordRef}
        type="password"
        isRequired
        id="first-password"
        error={error ? lang(error) : undefined}
        placeholder={placeholder}
        value={password}
        onInput={handleInput}
      />

      <div className={modalStyles.buttons}>
        {onCancel && (
          <Button onClick={onCancel}>
            {cancelLabel}
          </Button>
        )}
        <Button
          isPrimary
          isLoading={isLoading}
          isDisabled={isSubmitDisabled}
          onClick={!isLoading ? handleSubmit : undefined}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

export default memo(PasswordForm);

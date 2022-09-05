import React, {
  memo, useCallback, useEffect, useRef, useState,
} from '../../lib/teact/teact';

import { ANIMATED_STICKERS_PATHS } from './helpers/animatedAssets';
import useFocusAfterAnimation from '../../hooks/useFocusAfterAnimation';

import AnimatedIcon from './AnimatedIcon';
import Button from './Button';
import Input from './Input';

import styles from './PasswordForm.module.scss';
import modalStyles from './Modal.module.scss';

interface OwnProps {
  isActive: boolean;
  isLoading?: boolean;
  cancelLabel?: string;
  onCancel: NoneToVoidFunction;
  submitLabel: string;
  onCleanError: NoneToVoidFunction;
  onSubmit: (password: string) => void;
  placeholder?: string;
  error?: string;
}

const STICKER_SIZE = 180;

function PasswordForm({
  isActive,
  isLoading,
  cancelLabel,
  submitLabel,
  placeholder,
  error,
  onCleanError,
  onCancel,
  onSubmit,
}: OwnProps) {
  // eslint-disable-next-line no-null/no-null
  const passwordRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState<string>('');

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

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.code === 'Enter') {
      handleSubmit();
    }
  }, [handleSubmit]);

  return (
    <div className={modalStyles.transitionContent}>
      <AnimatedIcon
        tgsUrl={ANIMATED_STICKERS_PATHS.holdTon}
        play={isActive}
        size={STICKER_SIZE}
        nonInteractive
        noLoop={false}
        className={styles.sticker}
      />
      <Input
        ref={passwordRef}
        type="password"
        isRequired
        id="first-password"
        error={error}
        placeholder={placeholder}
        value={password}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
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
          isDisabled={!password.length}
          onClick={!isLoading ? handleSubmit : undefined}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

export default memo(PasswordForm);

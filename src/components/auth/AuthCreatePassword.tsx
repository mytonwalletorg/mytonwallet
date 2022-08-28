import React, {
  memo, useCallback, useEffect, useRef, useState,
} from '../../lib/teact/teact';

import { getActions } from '../../global';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';
import buildClassName from '../../util/buildClassName';
import useFocusAfterAnimation from '../../hooks/useFocusAfterAnimation';
import { usePasswordValidation } from '../../hooks/usePasswordValidation';
import useFlag from '../../hooks/useFlag';

import AnimatedIcon from '../ui/AnimatedIcon';
import Button from '../ui/Button';
import Input from '../ui/Input';

import styles from './Auth.module.scss';

interface OwnProps {
  isActive?: boolean;
  isImporting?: boolean;
  isLoading?: boolean;
}

const AuthCreatePassword = ({
  isActive,
  isImporting,
  isLoading,
}: OwnProps) => {
  const { afterCreatePassword, restartAuth } = getActions();

  // eslint-disable-next-line no-null/no-null
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [firstPassword, setFirstPassword] = useState<string>('');
  const [secondPassword, setSecondPassword] = useState<string>('');
  const [hasError, setHasError] = useState<boolean>(false);
  const [isJustSubmitted, setIsJustSubmitted] = useState<boolean>(false);
  const [isPasswordFocused, markPasswordFocused, unmarkPasswordFocused] = useFlag(false);
  const [isSecondPasswordFocused, markSecondPasswordFocused, unmarkSecondPasswordFocused] = useFlag(false);
  const [isPasswordsNotEqual, setIsPasswordsNotEqual] = useState<boolean>(false);
  const canSubmit = firstPassword.length > 0 && secondPassword.length > 0 && !hasError;

  const validation = usePasswordValidation({
    firstPassword,
    secondPassword,
  });

  useFocusAfterAnimation({
    ref: firstInputRef,
    isActive,
  });

  useEffect(() => {
    setIsPasswordsNotEqual(false);
    if (firstPassword === '' || !isActive) {
      setHasError(false);
      return;
    }

    const {
      invalidLength,
      noUpperCase,
      noLowerCase,
      noNumber,
      noSpecialChar,
      noEqual,
    } = validation;

    if (invalidLength || noUpperCase || noLowerCase || noNumber || noSpecialChar) {
      setHasError(true);
    } else if ((!isSecondPasswordFocused || isJustSubmitted) && noEqual && secondPassword !== '') {
      setHasError(true);
      setIsPasswordsNotEqual(true);
    } else if (!noEqual || secondPassword === '' || (isSecondPasswordFocused && !isJustSubmitted)) {
      setHasError(false);
    }
  }, [
    isActive, firstPassword, secondPassword, validation, isSecondPasswordFocused, isPasswordFocused, isJustSubmitted,
  ]);

  const handleFirstPasswordChange = useCallback((value: string) => {
    setFirstPassword(value);
    if (isJustSubmitted) {
      setIsJustSubmitted(false);
    }
  }, [isJustSubmitted]);

  const handleSecondPasswordChange = useCallback((value: string) => {
    setSecondPassword(value);
    if (isJustSubmitted) {
      setIsJustSubmitted(false);
    }
  }, [isJustSubmitted]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!canSubmit) {
      return;
    }

    if (firstPassword !== secondPassword) {
      setIsJustSubmitted(true);
      setHasError(true);
      setIsPasswordsNotEqual(true);
      return;
    }

    afterCreatePassword({ password: firstPassword, isImporting });
  }, [afterCreatePassword, canSubmit, firstPassword, isImporting, secondPassword]);

  const shouldRenderError = hasError && !isPasswordFocused;

  function renderErrors() {
    if (isPasswordsNotEqual) {
      return (
        <div className={buildClassName(styles.errors, styles.invalid)}>
          Passwords must be equal.
        </div>
      );
    }

    const {
      invalidLength,
      noUpperCase,
      noLowerCase,
      noNumber,
      noSpecialChar,
    } = validation;

    return (
      <div className={styles.passwordRules}>
        Password must contain
        <span className={getValidationRuleClass(shouldRenderError, invalidLength)}> at least 8 characters,</span>
        <span className={getValidationRuleClass(shouldRenderError, noLowerCase)}> one small letter,</span>
        <span className={getValidationRuleClass(shouldRenderError, noUpperCase)}> one capital letter,</span>
        <span className={getValidationRuleClass(shouldRenderError, noNumber)}> one digit,</span>
        <span className={getValidationRuleClass(shouldRenderError, noSpecialChar)}> and one special character</span>.
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={buildClassName(styles.container, styles.container_scrollable, 'custom-scroll')}
    >
      <AnimatedIcon
        play={isActive}
        tgsUrl={ANIMATED_STICKERS_PATHS.happy}
        noLoop={false}
        nonInteractive
        className={styles.sticker}
      />
      <div className={styles.title}>Congratulations!</div>
      <p className={styles.info}>
        <strong>The wallet is {isImporting ? 'imported' : 'ready'}.</strong>
      </p>
      <p className={styles.info}>
        Create a password to protect it.
      </p>

      <div className={styles.form}>
        <Input
          ref={firstInputRef}
          type="password"
          isRequired
          id="first-password"
          hasError={shouldRenderError}
          placeholder="Enter your password..."
          value={firstPassword}
          onInput={handleFirstPasswordChange}
          onFocus={markPasswordFocused}
          onBlur={unmarkPasswordFocused}
        />
        <Input
          type="password"
          isRequired
          id="second-password"
          placeholder="...and repeat it"
          hasError={isPasswordsNotEqual}
          value={secondPassword}
          onInput={handleSecondPasswordChange}
          onFocus={markSecondPasswordFocused}
          onBlur={unmarkSecondPasswordFocused}
        />
      </div>

      {renderErrors()}

      <div className={buildClassName(styles.buttons, styles.buttons__inner)}>
        <Button onClick={restartAuth} className={styles.btn}>
          Cancel
        </Button>
        <Button
          isSubmit
          isPrimary
          isDisabled={!canSubmit}
          className={styles.btn}
          isLoading={isLoading}
        >
          Continue
        </Button>
      </div>
    </form>
  );
};

function getValidationRuleClass(shouldRenderError: boolean, ruleHasError: boolean) {
  return buildClassName(
    styles.passwordRule,
    !ruleHasError ? styles.valid : shouldRenderError ? styles.invalid : undefined,
  );
}

export default memo(AuthCreatePassword);

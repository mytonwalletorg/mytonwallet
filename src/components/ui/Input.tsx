import type {
  ChangeEvent, FormEvent, KeyboardEvent, RefObject,
} from 'react';
import type { TeactNode } from '../../lib/teact/teact';
import React, { memo, useState } from '../../lib/teact/teact';

import { requestMutation } from '../../lib/fasterdom/fasterdom';
import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';

import styles from './Input.module.scss';

type OwnProps = {
  ref?: RefObject<HTMLInputElement | HTMLTextAreaElement>;
  id?: string;
  type?: 'text' | 'password';
  label?: TeactNode;
  placeholder?: string;
  value?: string | number;
  inputMode?: 'numeric' | 'text' | 'search';
  maxLength?: number;
  isRequired?: boolean;
  isControlled?: boolean;
  isMultiline?: boolean;
  hasError?: boolean;
  error?: string;
  className?: string;
  wrapperClassName?: string;
  autoComplete?: string;
  inputArg?: any;
  children?: TeactNode;
  onInput: (value: string, inputArg?: any) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
};

function Input({
  ref,
  id,
  label,
  placeholder,
  inputMode,
  isRequired,
  isControlled,
  isMultiline,
  hasError,
  type = 'text',
  error,
  value = '',
  maxLength,
  inputArg,
  className,
  wrapperClassName,
  autoComplete,
  children,
  onInput,
  onKeyDown,
  onFocus,
  onBlur,
}: OwnProps) {
  const lang = useLang();
  const [isPasswordVisible, setIsPasswordVisible] = useState<boolean>(false);

  const handleInput = (e: FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onInput(e.currentTarget.value, inputArg);
  };

  const handleTogglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const { currentTarget } = e;
    const { scrollHeight } = currentTarget;

    requestMutation(() => {
      currentTarget.style.height = '0';
      currentTarget.style.height = `${scrollHeight}px`;
    });
  };

  const finalType = type === 'text' || isPasswordVisible ? 'text' : 'password';
  const inputFullClass = buildClassName(
    styles.input,
    className,
    type === 'password' && styles.input_password,
    (hasError || error) && styles.error,
  );
  const labelFullClass = buildClassName(
    styles.label,
    (hasError || error) && styles.error,
    (hasError || error) && type === 'password' && styles.label_forPassword,
  );

  return (
    <div className={buildClassName(styles.wrapper, wrapperClassName)}>
      {error && !!label && (
        <label className={buildClassName(styles.label, styles.label_error, styles.error)} htmlFor={id}>{error}</label>
      )}
      {!!label && (
        <label className={labelFullClass} htmlFor={id}>
          {label}
        </label>
      )}
      {isMultiline ? (
        <textarea
          ref={ref as RefObject<HTMLTextAreaElement>}
          id={id}
          className={inputFullClass}
          value={value}
          maxLength={maxLength}
          autoComplete={autoComplete}
          onInput={handleInput}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onBlur={onBlur}
          tabIndex={0}
          required={isRequired}
          placeholder={placeholder}
          teactExperimentControlled={isControlled}
        />
      ) : (
        <input
          ref={ref as RefObject<HTMLInputElement>}
          id={id}
          className={inputFullClass}
          type={finalType}
          value={value}
          inputMode={inputMode}
          maxLength={maxLength}
          autoComplete={autoComplete}
          onInput={handleInput}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onBlur={onBlur}
          tabIndex={0}
          required={isRequired}
          placeholder={placeholder}
          teactExperimentControlled={isControlled}
        />
      )}
      {type === 'password' && (
        <button
          className={buildClassName(styles.visibilityToggle, label && styles.visibilityToggle_push)}
          type="button"
          onClick={handleTogglePasswordVisibility}
          aria-label={lang('Change password visibility')}
          tabIndex={-1}
        >
          <i className={isPasswordVisible ? 'icon-eye' : 'icon-eye-closed'} aria-hidden />
        </button>
      )}
      {error && !label && (
        <label className={buildClassName(styles.label, styles.label_errorBottom, styles.error)} htmlFor={id}>
          {error}
        </label>
      )}
      {children}
    </div>
  );
}

export default memo(Input);

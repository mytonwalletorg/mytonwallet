import { RefObject } from 'react';
import React, { memo, TeactNode, useState } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import useLang from '../../hooks/useLang';

import styles from './Input.module.scss';

type OwnProps = {
  ref?: RefObject<HTMLInputElement>;
  id?: string;
  type?: 'text' | 'password';
  labelText?: string;
  placeholder?: string;
  value?: string | number;
  maxLength?: number;
  isRequired?: boolean;
  isControlled?: boolean;
  hasError?: boolean;
  error?: string;
  className?: string;
  autoComplete?: string;
  inputArg?: any;
  children?: TeactNode | TeactNode[];
  onInput: (value: string, inputArg?: any) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus?: NoneToVoidFunction;
  onBlur?: NoneToVoidFunction;
};

function Input({
  ref,
  id,
  labelText,
  placeholder,
  isRequired,
  isControlled,
  hasError,
  type = 'text',
  error,
  value = '',
  maxLength,
  inputArg,
  className,
  autoComplete,
  children,
  onInput,
  onKeyDown,
  onFocus,
  onBlur,
}: OwnProps) {
  const lang = useLang();
  const [isPasswordVisible, setIsPasswordVisible] = useState<boolean>(false);

  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    onInput(e.currentTarget.value, inputArg);
  };

  const handleTogglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
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
    <div className={styles.wrapper}>
      {error && labelText && (
        <label className={buildClassName(styles.label, styles.label_error, styles.error)} htmlFor={id}>{error}</label>
      )}
      {labelText && (
        <label className={labelFullClass} htmlFor={id}>
          {labelText}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={inputFullClass}
        type={finalType}
        value={value}
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
      {type === 'password' && (
        <button
          className={buildClassName(styles.visibilityToggle, labelText && styles.visibilityToggle_push)}
          type="button"
          onClick={handleTogglePasswordVisibility}
          aria-label={lang('Change password visibility')}
          tabIndex={-1}
        >
          <i className={isPasswordVisible ? 'icon-eye' : 'icon-eye-closed'} />
        </button>
      )}
      {error && !labelText && (
        <label className={buildClassName(styles.label, styles.label_errorBottom, styles.error)} htmlFor={id}>
          {error}
        </label>
      )}
      {children}
    </div>
  );
}

export default memo(Input);

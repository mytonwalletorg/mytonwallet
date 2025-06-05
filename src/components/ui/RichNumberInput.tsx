import type { TeactNode } from '../../lib/teact/teact';
import React, { memo, useLayoutEffect, useRef } from '../../lib/teact/teact';

import { FRACTION_DIGITS } from '../../config';
import buildClassName from '../../util/buildClassName';
import { saveCaretPosition } from '../../util/saveCaretPosition';
import { buildContentHtml } from './helpers/buildContentHtml';

import useFlag from '../../hooks/useFlag';
import useFontScale from '../../hooks/useFontScale';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import styles from './Input.module.scss';

type OwnProps = {
  id?: string;
  labelText?: TeactNode;
  value?: string;
  hasError?: boolean;
  isLoading?: boolean;
  suffix?: string;
  className?: string;
  inputClassName?: string;
  labelClassName?: string;
  valueClassName?: string;
  cornerClassName?: string;
  children?: TeactNode;
  onChange?: (value?: string) => void;
  onBlur?: NoneToVoidFunction;
  onFocus?: NoneToVoidFunction;
  onPressEnter?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  /** Expected to fire when regardless of the `disabled` prop value */
  onInputClick?: NoneToVoidFunction;
  decimals?: number;
  disabled?: boolean;
  isStatic?: boolean;
  size?: 'large' | 'normal';
};

const MIN_LENGTH_FOR_SHRINK = 5;

function RichNumberInput({
  id,
  labelText,
  hasError,
  isLoading = false,
  suffix,
  value,
  children,
  className,
  inputClassName,
  labelClassName,
  valueClassName,
  cornerClassName,
  onChange,
  onBlur,
  onFocus,
  onPressEnter,
  onInputClick,
  decimals = FRACTION_DIGITS,
  disabled = false,
  isStatic = false,
  size = 'large',
}: OwnProps) {
  const inputRef = useRef<HTMLInputElement>();
  const lang = useLang();

  const [hasFocus, markHasFocus, unmarkHasFocus] = useFlag(false);
  const { updateFontScale, isFontChangedRef } = useFontScale(inputRef);

  const textRef = useRef('');

  const updateHtml = useLastCallback((newText: string) => {
    const input = inputRef.current!;
    const html = buildContentHtml(newText, suffix, decimals);

    if (html !== input.innerHTML) {
      const restoreCaretPosition = document.activeElement === input
        ? saveCaretPosition(input, decimals)
        : undefined;

      input.innerHTML = html;
      restoreCaretPosition?.();
    }

    if (newText.length > MIN_LENGTH_FOR_SHRINK || isFontChangedRef.current) {
      updateFontScale(html);
    }
  });

  useLayoutEffect(() => {
    const newText = clearText(value);

    if (!newText || !textRef.current.startsWith(newText)) {
      updateHtml(newText);
      textRef.current = newText;
    }
  }, [decimals, textRef, value]);

  function handleChange(e: React.FormEvent<HTMLDivElement>) {
    const newText = clearText(e.currentTarget.textContent ?? undefined);

    updateHtml(newText);

    if (newText !== textRef.current) {
      textRef.current = newText;

      if (onChange && isValidValue(newText)) {
        onChange(newText);
      }
    }
  }

  const handleFocus = useLastCallback(() => {
    if (disabled) return;

    markHasFocus();
    onFocus?.();
  });

  const handleBlur = useLastCallback(() => {
    if (disabled) return;

    unmarkHasFocus();
    onBlur?.();
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      onPressEnter?.(e);
    }
  };

  const inputWrapperFullClass = buildClassName(
    styles.input__wrapper,
    isStatic && styles.inputWrapperStatic,
    hasError && styles.error,
    hasFocus && styles.input__wrapper_hasFocus,
    inputClassName,
  );
  const inputFullClass = buildClassName(
    styles.input,
    styles.input_rich,
    size === 'large' && styles.input_large,
    valueClassName,
    disabled && styles.disabled,
    isLoading && styles.isLoading,
    'rounded-font',
  );
  const labelTextClassName = buildClassName(
    styles.label,
    hasError && styles.error,
    labelClassName,
  );
  const cornerFullClass = buildClassName(
    cornerClassName,
    hasFocus && styles.swapCorner,
    hasError && styles.swapCorner_error,
  );

  return (
    <div className={buildClassName(styles.wrapper, className)}>
      {Boolean(labelText) && (
        <label
          className={labelTextClassName}
          htmlFor={id}
          id={`${id}Label`}
        >
          {labelText}
        </label>
      )}
      <div className={inputWrapperFullClass}>
        <div
          ref={inputRef}
          contentEditable={!disabled && !isLoading}
          id={id}
          role="textbox"
          aria-required
          aria-placeholder={lang('Amount value')}
          aria-labelledby={labelText ? `${id}Label` : undefined}
          tabIndex={0}
          inputMode="decimal"
          className={inputFullClass}
          onKeyDown={handleKeyDown}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onClick={onInputClick}
        />
        {children}
      </div>
      {cornerClassName && <div className={cornerFullClass} />}
    </div>
  );
}

function clearText(text?: string) {
  if (!text) return '';

  return (
    text
      .trim()
      .replace(',', '.') // Replace comma to point
      .replace(/[^\d.]/g, '') // Remove incorrect symbols
      .replace(/^0+(?=([1-9]|0\.))/, '') // Trim extra zeros at beginning
      .replace(/^0+$/, '0') // Trim extra zeros (if only zeros are entered)
      ?? ''
  );
}

function isValidValue(text: string) {
  return !Number.isNaN(Number(text));
}

export default memo(RichNumberInput);

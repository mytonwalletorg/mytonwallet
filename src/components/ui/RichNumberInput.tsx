import type { TeactNode } from '../../lib/teact/teact';
import React, { memo, useLayoutEffect, useRef } from '../../lib/teact/teact';

import { FRACTION_DIGITS, WHOLE_PART_DELIMITER } from '../../config';
import { requestMutation } from '../../lib/fasterdom/fasterdom';
import { getNumberParts, getNumberRegex } from '../../global/helpers/number';
import buildClassName from '../../util/buildClassName';
import { saveCaretPosition } from '../../util/saveCaretPosition';

import useFlag from '../../hooks/useFlag';
import useFontScale from '../../hooks/useFontScale';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import styles from './Input.module.scss';

type OwnProps = {
  id?: string;
  labelText?: React.ReactNode;
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
  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lang = useLang();
  const [hasFocus, markHasFocus, unmarkHasFocus] = useFlag(false);
  const { updateFontScale, isFontChangedRef } = useFontScale(inputRef);

  const handleNumberHtml = useLastCallback((input: HTMLInputElement, parts?: RegExpMatchArray) => {
    const newHtml = parts ? buildContentHtml({ values: parts, suffix, decimals }) : '';
    const restoreCaretPosition = document.activeElement === inputRef.current
      ? saveCaretPosition(input, decimals)
      : undefined;

    input.innerHTML = newHtml;
    restoreCaretPosition?.();

    return newHtml;
  });

  const updateHtml = useLastCallback((parts?: RegExpMatchArray) => {
    const input = inputRef.current!;
    const content = handleNumberHtml(input, parts);
    const textContent = parts?.[0] || '';

    if (textContent.length > MIN_LENGTH_FOR_SHRINK || isFontChangedRef.current) {
      updateFontScale(content);
    }
    input.classList.toggle(styles.isEmpty, !content.length);
  });

  useLayoutEffect(() => {
    if (value === undefined) {
      updateHtml();
    } else {
      updateHtml(getNumberParts(value));
    }
  }, [updateHtml, value]);

  function handleChange(e: React.FormEvent<HTMLDivElement>) {
    const inputValue = e.currentTarget.innerText.trim();
    const newValue = clearValue(inputValue, decimals);
    const parts = getNumberParts(newValue, decimals);
    const isEmpty = inputValue === '';

    requestMutation(() => {
      if (!parts && !isEmpty && value) {
        updateHtml(getNumberParts(value, decimals));
      } else {
        updateHtml(parts);
      }

      if ((newValue || isEmpty) && newValue !== value) {
        onChange?.(newValue);
      }
    });
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
    if (e.key === 'Enter' && onPressEnter) {
      onPressEnter(e);
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
    !value && styles.isEmpty,
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
        {/* eslint-disable-next-line jsx-a11y/control-has-associated-label */}
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

function clearValue(value: string, decimals: number) {
  return value
    .replace(',', '.') // Replace comma to point
    .replace(/[^\d.]/, '') // Remove incorrect symbols
    .match(getNumberRegex(decimals))?.[0] // Trim extra decimal places
    .replace(/^0+(?=([1-9]|0\.))/, '') // Trim extra zeros at beginning
    .replace(/^0+$/, '0') // Trim extra zeros (if only zeros are entered)
    ?? '';
}

export function buildContentHtml({
  values,
  suffix,
  decimals = FRACTION_DIGITS,
  withRadix = false,
}: {
  values: RegExpMatchArray;
  suffix?: string;
  decimals?: number;
  withRadix?: boolean;
}) {
  let [, wholePart] = values;
  const [, , dotPart, fractionPart] = values;

  const fractionStr = (fractionPart || dotPart) ? `.${(fractionPart || '').substring(0, decimals)}` : '';
  const suffixStr = suffix ? `&thinsp;${suffix}` : '';

  if (withRadix) {
    wholePart = wholePart.replace(/\d(?=(\d{3})+($|\.))/g, `$&${WHOLE_PART_DELIMITER}`);
  }

  return `${wholePart}<span class="${styles.fractional}">${fractionStr}${suffixStr}</span>`;
}

export default memo(RichNumberInput);

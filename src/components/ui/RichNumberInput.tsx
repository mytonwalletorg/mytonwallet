import type { TeactNode } from '../../lib/teact/teact';
import React, {
  memo, useLayoutEffect, useRef, useState,
} from '../../lib/teact/teact';

import { DEFAULT_DECIMAL_PLACES, FRACTION_DIGITS } from '../../config';
import { Big } from '../../lib/big.js';
import buildClassName from '../../util/buildClassName';
import { round } from '../../util/round';
import { saveCaretPosition } from '../../util/saveCaretPosition';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import styles from './Input.module.scss';

type OwnProps = {
  id?: string;
  labelText?: React.ReactNode;
  value?: number;
  hasError?: boolean;
  isLoading?: boolean;
  suffix?: string;
  className?: string;
  inputClassName?: string;
  labelClassName?: string;
  valueClassName?: string;
  cornerClassName?: string;
  children?: TeactNode;
  onChange?: (value?: number) => void;
  onBlur?: NoneToVoidFunction;
  onFocus?: NoneToVoidFunction;
  onPressEnter?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  decimals?: number;
  disabled?: boolean;
  isStatic?: boolean;
};

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
  decimals = FRACTION_DIGITS,
  disabled = false,
  isStatic = false,
}: OwnProps) {
  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lang = useLang();
  const [hasFocus, markHasFocus, unmarkHasFocus] = useFlag(false);
  const [isContentEditable, setContentEditable] = useState(!disabled);

  const handleLoadingHtml = useLastCallback((input: HTMLInputElement, parts?: RegExpMatchArray) => {
    const newHtml = parts ? buildContentHtml(parts, suffix, decimals) : '';
    input.innerHTML = newHtml;
    setContentEditable(false);

    return newHtml;
  });

  const handleNumberHtml = useLastCallback((input: HTMLInputElement, parts?: RegExpMatchArray) => {
    const newHtml = parts ? buildContentHtml(parts, suffix, decimals) : '';
    const restoreCaretPosition = document.activeElement === inputRef.current
      ? saveCaretPosition(input, decimals)
      : undefined;

    input.innerHTML = newHtml;
    setContentEditable(!disabled);
    restoreCaretPosition?.();

    return newHtml;
  });

  const updateHtml = useLastCallback((parts?: RegExpMatchArray) => {
    const input = inputRef.current!;
    const content = isLoading ? handleLoadingHtml(input, parts) : handleNumberHtml(input, parts);

    input.classList.toggle(styles.isEmpty, !content.length);
  });

  useLayoutEffect(() => {
    const newValue = castValue(value);

    const parts = getParts(String(newValue));
    updateHtml(parts);

    if (value !== newValue) {
      onChange?.(newValue);
    }
  }, [decimals, onChange, updateHtml, value, suffix, isLoading, disabled]);

  function handleChange(e: React.FormEvent<HTMLDivElement>) {
    const inputValue = e.currentTarget.innerText.trim();
    const parts = getParts(inputValue, decimals);
    const isEmpty = inputValue === '';

    if (!parts && !isEmpty && value) {
      updateHtml(getParts(String(value), decimals));
    } else {
      updateHtml(parts);
    }

    const newValue = castValue(Number(inputValue), decimals);
    if ((newValue || isEmpty) && newValue !== value) {
      onChange?.(newValue);
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
    !value && styles.isEmpty,
    valueClassName,
    isLoading && styles.isLoading,
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
          contentEditable={isContentEditable}
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
        />
        {children}
      </div>
      {cornerClassName && <div className={cornerFullClass} />}
    </div>
  );
}

function getParts(value: string, decimals = DEFAULT_DECIMAL_PLACES) {
  const regex = getInputRegex(decimals);
  // Correct problem with numbers like 1e-8
  if (value.includes('e-')) {
    Big.NE = -decimals - 1;
    return new Big(value).toString().match(regex) || undefined;
  }
  return value.match(regex) || undefined;
}

export function getInputRegex(decimals: number) {
  if (!decimals) return /^(\d+)$/;
  return new RegExp(`^(\\d+)([.,])?(\\d{1,${decimals}})?`);
}

function castValue(value?: number | string, decimals = DEFAULT_DECIMAL_PLACES) {
  return value && Number.isFinite(Number(value)) ? round(value, decimals, Big.roundDown) : undefined;
}

export function buildContentHtml(values: RegExpMatchArray, suffix?: string, decimals = FRACTION_DIGITS) {
  const [, wholePart, dotPart, fractionPart] = values;

  const wholeStr = String(parseInt(wholePart, 10)); // Properly handle leading zero
  const fractionStr = (fractionPart || dotPart) ? `.${(fractionPart || '').substring(0, decimals)}` : '';
  const suffixStr = suffix ? ` ${suffix}` : '';

  return `${wholeStr}<span class="${styles.fractional}">${fractionStr}${suffixStr}</span>`;
}

export default memo(RichNumberInput);

import type { TeactNode } from '../../lib/teact/teact';
import React, {
  memo,
  useCallback, useEffect, useRef,
} from '../../lib/teact/teact';

import { FRACTION_DIGITS } from '../../config';
import buildClassName from '../../util/buildClassName';
import { floor } from '../../util/round';
import { saveCaretPosition } from '../../util/saveCaretPosition';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';

import styles from './Input.module.scss';

type OwnProps = {
  id?: string;
  labelText?: string;
  value?: number;
  hasError?: boolean;
  suffix?: string;
  className?: string;
  inputClassName?: string;
  labelClassName?: string;
  valueClassName?: string;
  children?: TeactNode;
  onChange?: (value?: number) => void;
  onBlur?: NoneToVoidFunction;
  onPressEnter?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  decimals?: number;
};

function RichNumberInput({
  id,
  labelText,
  hasError,
  suffix,
  value,
  children,
  className,
  inputClassName,
  labelClassName,
  valueClassName,
  onChange,
  onBlur,
  onPressEnter,
  decimals = FRACTION_DIGITS,
}: OwnProps) {
  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lang = useLang();
  const [hasFocus, markHasFocus, unmarkHasFocus] = useFlag(false);

  const updateHtml = useCallback((parts?: RegExpMatchArray) => {
    const input = inputRef.current!;
    const newHtml = parts ? buildContentHtml(parts, suffix, decimals) : '';

    const restoreCaretPosition = document.activeElement === inputRef.current
      ? saveCaretPosition(input, decimals)
      : undefined;
    input.innerHTML = newHtml;
    restoreCaretPosition?.();

    // Trick to remove pseudo-element with placeholder in this tick
    input.classList.toggle(styles.isEmpty, !newHtml.length);
  }, [decimals, suffix]);

  useEffect(() => {
    const newValue = castValue(value, decimals);

    const parts = getParts(String(newValue), decimals);
    updateHtml(parts);

    if (value !== newValue) {
      onChange?.(newValue);
    }
  }, [decimals, onChange, updateHtml, value]);

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

  const handleBlur = useCallback(() => {
    unmarkHasFocus();
    onBlur?.();
  }, [onBlur, unmarkHasFocus]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && onPressEnter) {
      onPressEnter(e);
    }
  };

  const inputWrapperFullClass = buildClassName(
    styles.input__wrapper,
    hasError && styles.error,
    hasFocus && styles.input__wrapper_hasFocus,
    inputClassName,
  );
  const inputFullClass = buildClassName(
    styles.input,
    styles.input_rich,
    !value && styles.isEmpty,
    valueClassName,
  );
  const labelTextClassName = buildClassName(
    styles.label,
    hasError && styles.error,
    labelClassName,
  );

  return (
    <div className={buildClassName(styles.wrapper, className)}>
      {labelText && (
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
          contentEditable
          id={id}
          role="textbox"
          aria-required
          aria-placeholder={lang('Amount value')}
          aria-labelledby={labelText ? `${id}Label` : undefined}
          tabIndex={0}
          className={inputFullClass}
          onKeyDown={handleKeyDown}
          onChange={handleChange}
          onFocus={markHasFocus}
          onBlur={handleBlur}
        />
        {children}
      </div>
    </div>
  );
}

function getParts(value: string, decimals: number) {
  return value.match(new RegExp(`^(\\d+)([.,])?(\\d{1,${decimals}})?$`)) || undefined;
}

function castValue(value?: number, decimals?: number) {
  return value ? floor(value, decimals) : undefined;
}

export function buildContentHtml(values: RegExpMatchArray, suffix?: string, decimals = FRACTION_DIGITS) {
  const [, wholePart, dotPart, fractionPart] = values;

  const wholeStr = String(parseInt(wholePart, 10)); // Properly handle leading zero
  const fractionStr = (fractionPart || dotPart) ? `.${(fractionPart || '').substring(0, decimals)}` : '';
  const suffixStr = suffix ? ` ${suffix}` : '';

  return `${wholeStr}<span class="${styles.fractional}">${fractionStr}${suffixStr}</span>`;
}

export default memo(RichNumberInput);

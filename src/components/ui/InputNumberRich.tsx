import React, {
  memo, useCallback, useLayoutEffect, useRef, useState, VirtualElement,
} from '../../lib/teact/teact';

import { FRACTION_DIGITS } from '../../config';
import { saveCaretPosition } from '../../util/saveCaretPosition';
import { formatInteger } from '../../util/formatNumber';
import buildClassName from '../../util/buildClassName';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';

import styles from './Input.module.scss';

type OwnProps = {
  id?: string;
  labelText?: string;
  value?: number;
  hasError?: boolean;
  error?: string;
  help?: string;
  suffix?: string;
  className?: string;
  isReadable?: boolean;
  zeroValue?: string;
  inputClassName?: string;
  labelClassName?: string;
  valueClassName?: string;
  children?: VirtualElement;
  onInput?: (value?: number) => void;
  onChange?: (e: React.FormEvent<HTMLDivElement>) => void;
  onBlur?: NoneToVoidFunction;
  onPressEnter?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  decimals?: number;
};

function InputNumberRich({
  id,
  labelText,
  hasError,
  error,
  help,
  suffix,
  value,
  isReadable,
  zeroValue,
  children,
  className,
  inputClassName,
  labelClassName,
  valueClassName,
  onChange,
  onInput,
  onBlur,
  onPressEnter,
  decimals = FRACTION_DIGITS,
}: OwnProps) {
  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lang = useLang();
  const prevValueRef = useRef<string>('');
  const [isEmpty, setIsEmpty] = useState<boolean>(true);
  const [hasFocus, markHasFocus, unmarkHasFocus] = useFlag(false);

  const updateInputValue = useCallback(() => {
    const newValue = Number(prevValueRef.current);
    if (onInput && !Number.isNaN(newValue) && newValue <= Number.MAX_SAFE_INTEGER) {
      onInput(newValue === 0 ? undefined : parseFloat(newValue.toFixed(FRACTION_DIGITS)));
    }
  }, [onInput]);

  const handleBlur = useCallback(() => {
    unmarkHasFocus();
    updateInputValue();
    onBlur?.();
  }, [onBlur, unmarkHasFocus, updateInputValue]);

  const renderZeroValue = useCallback(() => {
    if (!inputRef.current) {
      return;
    }

    setIsEmpty(false);
    inputRef.current.innerHTML = zeroValue!;
  }, [zeroValue]);

  const renderValue = useCallback((inputValue = '', shouldReset = false) => {
    if (!inputRef.current) {
      return;
    }

    const valueRegex = new RegExp(`^(\\d+)([.,])?(\\d{1,${decimals}})?$`);
    const values = inputValue.toString().match(valueRegex);

    // eslint-disable-next-line no-null/no-null
    if (values === null || values.length < 4 || values[0] === '') {
      if (shouldReset || inputValue === '') {
        prevValueRef.current = '';
        inputRef.current.innerText = '';
        onInput?.(undefined);
      } else {
        renderValue(prevValueRef.current, true);
      }

      setIsEmpty(shouldReset || prevValueRef.current === '');
      return;
    }

    prevValueRef.current = inputValue;
    setIsEmpty(false);

    const [, wholePart, dotPart, fractionPart] = values;

    const newHtml = `${parseInt(wholePart, 10)}${fractionPart || dotPart
      ? `<span class="${styles.fractional}">.${(fractionPart || '').substring(0, FRACTION_DIGITS)} ${
        suffix ? ` ${suffix}` : ''
      }</span>`
      : ''
    }`;

    const restoreCaretPosition = document.activeElement === inputRef.current
      ? saveCaretPosition(inputRef.current)
      : undefined;

    // Trick for remove pseudo-element with placeholder in this tick
    inputRef.current.classList.toggle(styles.isEmpty, !newHtml.length);
    inputRef.current.innerHTML = newHtml;
    if (restoreCaretPosition) {
      restoreCaretPosition();
    }
    updateInputValue();
  }, [decimals, suffix, updateInputValue, onInput]);

  useLayoutEffect(() => {
    if (isReadable && zeroValue && !value) {
      renderZeroValue();
    } else if (value) {
      renderValue(formatInteger(value, FRACTION_DIGITS, true));
    }
  }, [isReadable, renderValue, renderZeroValue, value, zeroValue]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && onPressEnter) {
      onPressEnter(e);
    }
  };

  const handleChange = (e: React.FormEvent<HTMLDivElement>) => {
    onChange?.(e);
    const newValue = e.currentTarget.innerText.trim();
    renderValue(newValue);
  };

  const inputWrapperFullClass = buildClassName(
    styles.input__wrapper,
    (hasError || error) && styles.error,
    hasFocus && styles.input__wrapper_hasFocus,
    inputClassName,
  );
  const inputFullClass = buildClassName(
    styles.input,
    styles.input_rich,
    isEmpty && styles.isEmpty,
    isReadable && styles.disabled,
    valueClassName,
  );
  const labelTextClassName = buildClassName(
    styles.label,
    (hasError || error) && styles.error,
    isReadable && styles.help,
    labelClassName,
  );

  return (
    <div className={buildClassName(styles.wrapper, className)}>
      {error && (
        <label className={buildClassName(styles.label, styles.label_error, styles.error)} htmlFor={id}>{error}</label>
      )}
      {help && !error && (
        <label className={buildClassName(styles.label, styles.label_help, styles.help)} htmlFor={id}>{help}</label>
      )}
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
          contentEditable={!isReadable}
          id={id}
          role="textbox"
          aria-required
          aria-placeholder={lang('Amount value')}
          aria-labelledby={labelText ? `${id}Label` : undefined}
          tabIndex={isReadable ? -1 : 0}
          className={inputFullClass}
          onKeyDown={!isReadable ? handleKeyDown : undefined}
          onChange={!isReadable ? handleChange : undefined}
          onFocus={!isReadable ? markHasFocus : undefined}
          onBlur={!isReadable ? handleBlur : undefined}
        />
        {children}
      </div>
    </div>
  );
}

export default memo(InputNumberRich);

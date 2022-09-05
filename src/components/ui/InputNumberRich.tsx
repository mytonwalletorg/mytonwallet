import React, {
  memo, useCallback, useLayoutEffect, useRef, useState, VirtualElement,
} from '../../lib/teact/teact';

import { FRACTION_DIGITS } from '../../config';
import { saveCaretPosition } from '../../util/saveCaretPosition';
import buildClassName from '../../util/buildClassName';
import useFlag from '../../hooks/useFlag';

import styles from './Input.module.scss';

type OwnProps = {
  id?: string;
  labelText?: string;
  value?: number;
  hasError?: boolean;
  error?: string;
  children?: VirtualElement;
  onInput: (value?: number) => void;
  onChange?: (e: React.FormEvent<HTMLDivElement>) => void;
  onPressEnter?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
};

const VALUE_REGEX = /^([0-9]+)([.,])?([0-9]+)?$/;

function InputNumberRich({
  id,
  labelText,
  hasError,
  error,
  value,
  children,
  onChange,
  onInput,
  onPressEnter,
}: OwnProps) {
  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement | null>(null);
  const prevValueRef = useRef<string>('');
  const [isEmpty, setIsEmpty] = useState<boolean>(true);
  const [hasFocus, markHasFocus, unmarkHasFocus] = useFlag(false);

  const handleBlur = useCallback(() => {
    unmarkHasFocus();
    const newValue = Number(prevValueRef.current);
    if (!Number.isNaN(newValue)) {
      onInput(newValue === 0 ? undefined : parseFloat(newValue.toFixed(FRACTION_DIGITS)));
    }
  }, [onInput, unmarkHasFocus]);

  const renderValue = useCallback((inputValue = '', shouldReset = false) => {
    if (!inputRef.current) {
      return;
    }

    const values = inputValue.toString().match(VALUE_REGEX);

    // eslint-disable-next-line no-null/no-null
    if (values === null || values.length < 4 || values[0] === '') {
      if (shouldReset || inputValue === '') {
        prevValueRef.current = '';
        inputRef.current.innerText = '';
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
      ? `<span class="${styles.fractional}">.${(fractionPart || '').substring(0, FRACTION_DIGITS)}</span>`
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
    handleBlur();
  }, [handleBlur]);

  useLayoutEffect(() => {
    if (value) {
      renderValue(value.toString());
    }
  }, [renderValue, value]);

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

  const inputFullClass = buildClassName(
    styles.input__wrapper,
    (hasError || error) && styles.error,
    hasFocus && styles.input__wrapper_hasFocus,
  );

  return (
    <div className={styles.wrapper}>
      {error && (
        <label className={buildClassName(styles.label, styles.label_error, styles.error)} htmlFor={id}>{error}</label>
      )}
      {labelText && (
        <label
          className={buildClassName(styles.label, (hasError || error) && styles.error)}
          htmlFor={id}
          id={`${id}Label`}
        >
          {labelText}
        </label>
      )}
      <div className={inputFullClass}>
        {/* eslint-disable-next-line jsx-a11y/control-has-associated-label */}
        <div
          ref={inputRef}
          contentEditable
          id={id}
          role="textbox"
          aria-required
          aria-placeholder="Amount value"
          aria-labelledby={labelText ? `${id}Label` : undefined}
          tabIndex={0}
          className={buildClassName(styles.input, styles.input_rich, isEmpty && styles.isEmpty)}
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

export default memo(InputNumberRich);

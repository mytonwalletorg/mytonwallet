import type { TeactNode } from '../../lib/teact/teact';
import React, {
  memo, useLayoutEffect, useRef,
} from '../../lib/teact/teact';

import { FRACTION_DIGITS } from '../../config';
import { getNumberRegex } from '../../global/helpers/number';
import buildClassName from '../../util/buildClassName';

import useFontScale from '../../hooks/useFontScale';
import useLastCallback from '../../hooks/useLastCallback';

import { buildContentHtml } from './RichNumberInput';

import styles from './Input.module.scss';

type OwnProps = {
  id?: string;
  labelText?: string;
  value?: string;
  error?: string;
  suffix?: string;
  zeroValue?: string;
  decimals?: number;
  className?: string;
  inputClassName?: string;
  labelClassName?: string;
  valueClassName?: string;
  children?: TeactNode;
};

const MIN_LENGTH_FOR_SHRINK = 5;

function RichNumberField({
  id,
  labelText,
  value,
  error,
  suffix,
  zeroValue,
  decimals = FRACTION_DIGITS,
  className,
  inputClassName,
  labelClassName,
  valueClassName,
  children,
}: OwnProps) {
  // eslint-disable-next-line no-null/no-null
  const contentRef = useRef<HTMLInputElement | null>(null);
  const prevValueRef = useRef<string>('');
  const { updateFontScale, isFontChangedRef } = useFontScale(contentRef, true);

  const renderValue = useLastCallback((inputValue = '', noFallbackToPrev = false) => {
    const contentEl = contentRef.current!;

    const valueRegex = getNumberRegex(decimals);
    const values = inputValue.toString().match(valueRegex);

    // eslint-disable-next-line no-null/no-null
    if (values === null || values.length < 4 || values[0] === '') {
      if (noFallbackToPrev || inputValue === '') {
        prevValueRef.current = '';
        contentEl.innerText = '';
      } else {
        renderValue(prevValueRef.current, true);
      }

      return;
    }
    const textContent = values?.[0] || '';
    prevValueRef.current = inputValue;

    const content = buildContentHtml({
      values, suffix, decimals, withRadix: true,
    });
    contentEl.innerHTML = content;

    if (textContent.length > MIN_LENGTH_FOR_SHRINK || isFontChangedRef.current) {
      updateFontScale(content);
    }
  });

  useLayoutEffect(() => {
    if (value) {
      renderValue(value);
    } else if (zeroValue) {
      contentRef.current!.innerHTML = zeroValue;
    }
  }, [decimals, renderValue, value, zeroValue]);

  const inputWrapperFullClass = buildClassName(
    styles.input__wrapper,
    inputClassName,
  );
  const inputFullClass = buildClassName(
    styles.input,
    styles.input_rich,
    styles.input_large,
    styles.disabled,
    error && styles.error,
    valueClassName,
    'rounded-font',
  );
  const labelTextClassName = buildClassName(
    styles.label,
    labelClassName,
  );

  return (
    <div className={buildClassName(styles.wrapper, className)}>
      {error && (
        <label className={buildClassName(styles.label, styles.label_error, styles.error)} htmlFor={id}>{error}</label>
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
        <div
          ref={contentRef}
          id={id}
          className={inputFullClass}
        />
        {children}
      </div>
    </div>
  );
}

export default memo(RichNumberField);

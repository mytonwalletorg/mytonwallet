import type { TeactNode } from '../../lib/teact/teact';
import React, { memo, useLayoutEffect, useRef } from '../../lib/teact/teact';

import type { SensitiveDataMaskSkin } from '../common/SensitiveDataMask';

import { FRACTION_DIGITS } from '../../config';
import { getNumberRegex } from '../../global/helpers/number';
import buildClassName from '../../util/buildClassName';
import { buildContentHtml } from './helpers/buildContentHtml';

import useFontScale from '../../hooks/useFontScale';
import useLastCallback from '../../hooks/useLastCallback';

import SensitiveData from './SensitiveData';

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
  isSensitiveData?: true;
  isSensitiveDataHidden?: true;
  sensitiveDataMaskSkin?: SensitiveDataMaskSkin;
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
  isSensitiveData,
  isSensitiveDataHidden,
  sensitiveDataMaskSkin,
  inputClassName,
  labelClassName,
  valueClassName,
  children,
}: OwnProps) {
  const contentRef = useRef<HTMLInputElement>();
  const prevValueRef = useRef<string>('');
  const { updateFontScale, isFontChangedRef } = useFontScale(contentRef, true);

  const renderValue = useLastCallback((inputValue = '', noFallbackToPrev = false) => {
    const contentEl = contentRef.current!;

    const valueRegex = getNumberRegex(decimals);
    const values = inputValue.match(valueRegex);

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

    const html = buildContentHtml(inputValue, suffix, decimals, true);
    contentEl.innerHTML = html;

    if (textContent.length > MIN_LENGTH_FOR_SHRINK || isFontChangedRef.current) {
      updateFontScale(html);
    }
  });

  useLayoutEffect(() => {
    if (value) {
      renderValue(value);
    } else if (zeroValue) {
      contentRef.current!.textContent = zeroValue;
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
        {isSensitiveData ? (
          <SensitiveData
            isActive={isSensitiveDataHidden}
            cols={8}
            rows={3}
            cellSize={16}
            maskSkin={sensitiveDataMaskSkin}
            className={inputFullClass}
            contentClassName={valueClassName}
            maskClassName={styles.mask}
          >
            <div ref={contentRef} id={id} />
          </SensitiveData>
        ) : (
          <div ref={contentRef} id={id} className={buildClassName(inputFullClass, valueClassName)} />
        )}
        {children}
      </div>
    </div>
  );
}

export default memo(RichNumberField);

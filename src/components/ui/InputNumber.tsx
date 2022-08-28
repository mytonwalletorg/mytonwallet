import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import styles from './Input.module.scss';

type OwnProps = {
  id?: string;
  labelText?: string;
  value?: string | number;
  minValue?: number;
  isRequired?: boolean;
  hasError?: boolean;
  onInput: (value: number) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
};

const STEP = 1e-6;

function InputNumber({
  id,
  labelText,
  isRequired,
  hasError,
  value = '',
  minValue,
  onInput,
  onKeyDown,
}: OwnProps) {
  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    const { currentTarget: target } = e;
    onInput(Number(target.value.replace(/,/g, '.').replace(/[^.\d]+/, '')));
  };

  return (
    <div className={styles.wrapper}>
      <input
        id={id}
        className={buildClassName(styles.input, value !== '' && styles.touched, hasError && styles.error)}
        type="number"
        value={value}
        min={minValue}
        step={STEP}
        onInput={handleInput}
        onKeyDown={onKeyDown}
        tabIndex={0}
        required={isRequired}
      />
      {labelText && (
        <label className={styles.label} htmlFor={id}>{labelText}</label>
      )}
    </div>
  );
}

export default memo(InputNumber);

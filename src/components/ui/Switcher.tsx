import type { ChangeEvent } from 'react';
import React, { memo, useCallback } from '../../lib/teact/teact';

import styles from './Switcher.module.scss';
import buildClassName from '../../util/buildClassName';

type OwnProps = {
  id?: string;
  name?: string;
  value?: string;
  label: string;
  checked?: boolean;
  className?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onCheck?: (isChecked: boolean) => void;
};

function Switcher({
  id,
  name,
  value,
  label,
  checked = false,
  className,
  onChange,
  onCheck,
}: OwnProps) {
  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(e);
    }

    if (onCheck) {
      onCheck(e.currentTarget.checked);
    }
  }, [onChange, onCheck]);

  return (
    <label className={buildClassName(styles.container, className)} title={label}>
      <input
        type="checkbox"
        id={id}
        name={name}
        value={value}
        checked={checked}
        className={styles.input}
        onChange={handleChange}
      />
      <span className={styles.widget} />
    </label>
  );
}

export default memo(Switcher);

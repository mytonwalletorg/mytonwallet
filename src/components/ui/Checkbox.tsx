import type { ChangeEvent } from 'react';
import React, { memo, useCallback } from '../../lib/teact/teact';

import styles from './Checkbox.module.scss';

type OwnProps = {
  id?: string;
  children?: React.ReactNode;
  checked: boolean;
  onChange: (isChecked: boolean) => void;
};

function Checkbox({
  id,
  children,
  checked,
  onChange,
}: OwnProps) {
  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    onChange(e.currentTarget.checked);
  }, [onChange]);

  return (
    <label className={styles.wrapper}>
      <input
        id={id}
        type="checkbox"
        className={styles.input}
        checked={checked}
        tabIndex={0}
        onChange={handleChange}
      />
      <div className={styles.content}>
        {children}
      </div>
    </label>
  );
}

export default memo(Checkbox);

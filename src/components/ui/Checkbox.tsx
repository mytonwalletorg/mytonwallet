import type { ChangeEvent } from 'react';
import React, { memo, useCallback } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import styles from './Checkbox.module.scss';

type OwnProps = {
  id?: string;
  className?: string;
  children?: React.ReactNode;
  checked: boolean;
  onChange: (isChecked: boolean) => void;
};

function Checkbox({
  id,
  className,
  children,
  checked,
  onChange,
}: OwnProps) {
  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    onChange(e.currentTarget.checked);
  }, [onChange]);

  return (
    <label className={buildClassName(styles.wrapper, className)}>
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

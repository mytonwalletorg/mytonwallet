import type { ChangeEvent } from 'react';
import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import useLastCallback from '../../hooks/useLastCallback';

import styles from './Checkbox.module.scss';

type OwnProps = {
  id?: string;
  className?: string;
  contentClassName?: string;
  children?: React.ReactNode;
  checked: boolean;
  onChange: (isChecked: boolean) => void;
};

function Checkbox({
  id,
  className,
  contentClassName,
  children,
  checked,
  onChange,
}: OwnProps) {
  const handleChange = useLastCallback((e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    onChange(e.currentTarget.checked);
  });

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
      <div className={buildClassName(styles.content, contentClassName)}>
        {children}
      </div>
    </label>
  );
}

export default memo(Checkbox);

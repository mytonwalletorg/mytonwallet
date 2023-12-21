import type { ChangeEvent } from 'react';
import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import styles from './Switcher.module.scss';

type OwnProps = {
  id?: string;
  name?: string;
  value?: string;
  label?: string;
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
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if (onChange) {
      onChange(e);
    }

    if (onCheck) {
      onCheck(e.currentTarget.checked);
    }
  }

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
        teactExperimentControlled={!onChange && !onCheck}
      />
      <span className={styles.widget} />
    </label>
  );
}

export default memo(Switcher);

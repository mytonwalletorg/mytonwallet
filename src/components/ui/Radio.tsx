import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import styles from './Radio.module.scss';

interface OwnProps {
  id?: string;
  name: string;
  value: string;
  className?: string;
  isChecked?: boolean;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

function Radio({
  id, name, value, isChecked, className, onChange,
}: OwnProps) {
  return (
    <div className={buildClassName(styles.root, className, isChecked && styles.checked)}>
      <input
        id={id}
        type="radio"
        name={name}
        className="visually-hidden"
        value={value}
        checked={isChecked}
        onChange={onChange}
      />
    </div>
  );
}

export default memo(Radio);

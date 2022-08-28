import type { FocusEvent } from 'react';
import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import styles from './SearchBar.module.scss';

type OwnProps = {
  className?: string;
  onFocus?: (e: FocusEvent<HTMLInputElement>) => void;
  onBlur?: NoneToVoidFunction;
};

function SearchBar({ className, onFocus, onBlur }: OwnProps) {
  return (
    <div className={buildClassName(styles.wrapper, className)}>
      <input className={styles.input} onFocus={onFocus} onBlur={onBlur} placeholder="Search..." />
    </div>
  );
}

export default memo(SearchBar);

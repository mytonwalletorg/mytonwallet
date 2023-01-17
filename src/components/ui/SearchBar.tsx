import type { FocusEvent } from 'react';
import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import useLang from '../../hooks/useLang';

import styles from './SearchBar.module.scss';

type OwnProps = {
  className?: string;
  onFocus?: (e: FocusEvent<HTMLInputElement>) => void;
  onBlur?: NoneToVoidFunction;
};

function SearchBar({ className, onFocus, onBlur }: OwnProps) {
  const lang = useLang();

  return (
    <div className={buildClassName(styles.wrapper, className)}>
      <input className={styles.input} onFocus={onFocus} onBlur={onBlur} placeholder={lang('Search...')} />
    </div>
  );
}

export default memo(SearchBar);

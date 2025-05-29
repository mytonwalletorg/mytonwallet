import type { RefObject } from 'react';
import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';

import styles from './Spinner.module.scss';

type OwnProps = {
  ref?: RefObject<HTMLDivElement>;
  color?: 'white';
  className?: string;
};

function Spinner({ ref, color, className }: OwnProps) {
  const lang = useLang();

  const fullClassName = buildClassName(
    styles.spinner,
    color && styles[color],
    className,
  );

  return (
    <div ref={ref} className={fullClassName} aria-label={lang('Loading...')}>
      <i className={buildClassName(styles.inner, 'icon-spinner')} aria-hidden />
    </div>
  );
}

export default memo(Spinner);

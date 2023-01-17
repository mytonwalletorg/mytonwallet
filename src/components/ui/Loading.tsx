import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import useLang from '../../hooks/useLang';

import styles from './Loading.module.scss';

type OwnProps = {
  color?: 'blue' | 'white';
  backgroundColor?: 'light' | 'dark';
  className?: string;
};

function Loading({ color = 'blue', backgroundColor, className }: OwnProps) {
  const lang = useLang();

  const fullClassName = buildClassName(
    styles.spinner,
    styles[color],
    className,
    backgroundColor && styles.withBackground,
    backgroundColor && styles[backgroundColor],
  );

  return (
    <div className={fullClassName} aria-label={lang('Loading...')}>
      <div className={styles.inner} />
    </div>
  );
}

export default memo(Loading);

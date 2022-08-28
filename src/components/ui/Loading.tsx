import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import styles from './Loading.module.scss';

type OwnProps = {
  color?: 'blue' | 'white';
  backgroundColor?: 'light' | 'dark';
};

function Loading({ color = 'blue', backgroundColor }: OwnProps) {
  const fullClassName = buildClassName(
    styles.spinner,
    styles[color],
    backgroundColor && styles.withBackground,
    backgroundColor && styles[backgroundColor],
  );

  return (
    <div className={fullClassName} aria-label="Loading...">
      <div className={styles.inner} />
    </div>
  );
}

export default memo(Loading);

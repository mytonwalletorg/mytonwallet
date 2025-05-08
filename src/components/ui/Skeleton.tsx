import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import styles from './Skeleton.module.scss';

interface OwnProps {
  className?: string;
}

function Skeleton({ className }: OwnProps) {
  return <div className={buildClassName(styles.skeleton, className)} />;
}

export default memo(Skeleton);

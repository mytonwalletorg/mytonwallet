import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import useShowTransition from '../../hooks/useShowTransition';

import styles from './LoadingDots.module.scss';

interface OwnProps {
  isActive?: boolean;
  className?: string;
  isDoubled?: boolean;
}

function LoadingDots({ isActive, className, isDoubled }: OwnProps) {
  const { shouldRender, ref } = useShowTransition({
    isOpen: isActive,
    withShouldRender: true,
  });

  if (!shouldRender) {
    // eslint-disable-next-line no-null/no-null
    return null;
  }

  return (
    <div ref={ref} className={buildClassName(styles.root, isDoubled && styles.doubled, className)}>
      <span className={styles.dot} />
      <span className={styles.dot} />
      <span className={styles.dot} />
    </div>
  );
}

export default memo(LoadingDots);

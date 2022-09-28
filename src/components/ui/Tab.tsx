import React, { useRef, memo, useEffect } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import forceReflow from '../../util/forceReflow';

import styles from './Tab.module.scss';

type OwnProps = {
  className?: string;
  title: string;
  isActive?: boolean;
  previousActiveTab?: number;
  onClick: (arg: number) => void;
  clickArg: number;
};

function Tab({
  className,
  title,
  isActive,
  previousActiveTab,
  onClick,
  clickArg,
}: OwnProps) {
  // eslint-disable-next-line no-null/no-null
  const tabRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Set initial active state
    if (isActive && previousActiveTab === undefined && tabRef.current) {
      tabRef.current.classList.add(styles.Tab_active);
    }

    if (!isActive || previousActiveTab === undefined) {
      return;
    }

    const tabEl = tabRef.current!;
    const prevTabEl = tabEl.parentElement!.children[previousActiveTab];
    if (!prevTabEl) {
      return;
    }

    const platformEl = tabEl.querySelector('i')!;
    const prevPlatformEl = prevTabEl.querySelector('i')!;

    // We move and resize the platform, so it repeats the position and size of the previous one
    const shiftLeft = prevPlatformEl.parentElement!.offsetLeft - platformEl.parentElement!.offsetLeft;
    const scaleFactor = prevPlatformEl.clientWidth / platformEl.clientWidth;

    prevPlatformEl.classList.remove(styles.platform_animate);
    platformEl.classList.remove(styles.platform_animate);
    platformEl.style.transform = `translate3d(${shiftLeft}px, 0, 0) scale3d(${scaleFactor}, 1, 1)`;
    forceReflow(platformEl);
    platformEl.classList.add(styles.platform_animate);
    platformEl.style.transform = 'none';

    prevTabEl.classList.remove(styles.Tab_active);
    tabEl.classList.add(styles.Tab_active);
  }, [isActive, previousActiveTab]);

  return (
    <div
      className={buildClassName(styles.Tab, className)}
      onClick={!isActive ? () => onClick(clickArg) : undefined}
      ref={tabRef}
    >
      <span className={styles.content}>
        {title}
        <i className={styles.platform} />
      </span>
    </div>
  );
}

export default memo(Tab);

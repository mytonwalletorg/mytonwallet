import React, { useEffect, useLayoutEffect, useRef } from '../../lib/teact/teact';

import { requestForcedReflow, requestMutation } from '../../lib/fasterdom/fasterdom';
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

  useLayoutEffect(() => {
    // Set initial active state
    if (isActive && previousActiveTab === undefined && tabRef.current) {
      tabRef.current!.classList.add(styles.Tab_active);
    }
  }, [isActive, previousActiveTab]);

  useEffect(() => {
    if (!isActive || previousActiveTab === undefined) {
      return;
    }

    const tabEl = tabRef.current!;
    const prevTabEl = tabEl.parentElement!.children[previousActiveTab];
    if (!prevTabEl) {
      // The number of tabs in the parent component has decreased. It is necessary to add the active tab class name.
      if (isActive && !tabEl.classList.contains(styles.Tab_active)) {
        requestMutation(() => {
          tabEl.classList.add(styles.Tab_active);
        });
      }
      return;
    }

    const platformEl = tabEl.querySelector<HTMLElement>(`.${styles.platform}`)!;
    const prevPlatformEl = prevTabEl.querySelector<HTMLElement>(`.${styles.platform}`)!;

    // We move and resize the platform, so it repeats the position and size of the previous one
    const shiftLeft = prevPlatformEl.parentElement!.offsetLeft - platformEl.parentElement!.offsetLeft;
    const scaleFactor = prevPlatformEl.clientWidth / platformEl.clientWidth;

    requestMutation(() => {
      prevPlatformEl.classList.remove(styles.platform_animate);
      platformEl.classList.remove(styles.platform_animate);
      platformEl.style.transform = `translate3d(${shiftLeft}px, 0, 0) scale3d(${scaleFactor}, 1, 1)`;

      requestForcedReflow(() => {
        forceReflow(platformEl);

        return () => {
          platformEl.classList.add(styles.platform_animate);
          platformEl.style.transform = 'none';

          prevTabEl.classList.remove(styles.Tab_active);
          tabEl.classList.add(styles.Tab_active);
        };
      });
    });
  }, [isActive, previousActiveTab]);

  return (
    <div
      className={buildClassName(styles.Tab, className)}
      onClick={!isActive ? () => onClick(clickArg) : undefined}
      ref={tabRef}
    >
      <span className={styles.content}>
        {title}
        <i className={styles.platform} aria-hidden />
      </span>
    </div>
  );
}

export default Tab;

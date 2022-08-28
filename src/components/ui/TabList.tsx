import React, { memo, useRef, useEffect } from '../../lib/teact/teact';

import { IS_ANDROID, IS_IOS } from '../../util/environment';
import buildClassName from '../../util/buildClassName';
import fastSmoothScrollHorizontal from '../../util/fastSmoothScrollHorizontal';
import usePrevious from '../../hooks/usePrevious';
import useHorizontalScroll from '../../hooks/useHorizontalScroll';

import Tab from './Tab';

import styles from './TabList.module.scss';

export type TabWithProperties = {
  title: string;
  className?: string;
};

type OwnProps = {
  tabs: readonly TabWithProperties[];
  activeTab: number;
  big?: boolean;
  className?: string;
  onSwitchTab: (index: number) => void;
};

const TAB_SCROLL_THRESHOLD_PX = 16;
// Should match duration from `--slide-transition` CSS variable
const SCROLL_DURATION = IS_IOS ? 450 : IS_ANDROID ? 400 : 300;

function TabList({
  tabs, activeTab, big, className, onSwitchTab,
}: OwnProps) {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveTab = usePrevious(activeTab);

  useHorizontalScroll(containerRef.current);

  // Scroll container to place active tab in the center
  useEffect(() => {
    const container = containerRef.current!;
    const { scrollWidth, offsetWidth, scrollLeft } = container;
    if (scrollWidth <= offsetWidth) {
      return;
    }

    const activeTabElement = container.childNodes[activeTab] as HTMLElement | null;
    if (!activeTabElement) {
      return;
    }

    const { offsetLeft: activeTabOffsetLeft, offsetWidth: activeTabOffsetWidth } = activeTabElement;
    const newLeft = activeTabOffsetLeft - (offsetWidth / 2) + (activeTabOffsetWidth / 2);

    // Prevent scrolling by only a couple of pixels, which doesn't look smooth
    if (Math.abs(newLeft - scrollLeft) < TAB_SCROLL_THRESHOLD_PX) {
      return;
    }

    fastSmoothScrollHorizontal(container, newLeft, SCROLL_DURATION);
  }, [activeTab]);

  return (
    <div
      className={buildClassName(
        styles.container, 'no-scrollbar', big && styles.big, className,
      )}
      ref={containerRef}
    >
      {tabs.map((tab, i) => (
        <Tab
          key={tab.title}
          title={tab.title}
          isActive={i === activeTab}
          previousActiveTab={previousActiveTab}
          className={tab?.className}
          onClick={onSwitchTab}
          clickArg={i}
        />
      ))}
    </div>
  );
}

export default memo(TabList);

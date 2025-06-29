import React, { memo, useEffect, useRef } from '../../lib/teact/teact';

import type { DropdownItem } from './Dropdown';

import animateHorizontalScroll from '../../util/animateHorizontalScroll';
import buildClassName from '../../util/buildClassName';
import { IS_ANDROID, IS_IOS } from '../../util/windowEnvironment';

import useHorizontalScroll from '../../hooks/useHorizontalScroll';
import usePrevious from '../../hooks/usePrevious';

import Tab from './Tab';

import styles from './TabList.module.scss';

export type TabWithProperties = {
  id: number;
  title: string;
  className?: string;
  menuItems?: DropdownItem[];
  onMenuItemClick?: (value: string) => void;
  icon?: string;
};

type OwnProps = {
  tabs: readonly TabWithProperties[];
  activeTab: number;
  big?: boolean;
  className?: string;
  withBorder?: boolean;
  onSwitchTab: (index: number) => void;
};

const TAB_SCROLL_THRESHOLD_PX = 16;
// Should match duration from `--slide-transition` CSS variable
const SCROLL_DURATION = IS_IOS ? 450 : IS_ANDROID ? 400 : 300;

function TabList({
  tabs, activeTab, big, className, withBorder, onSwitchTab,
}: OwnProps) {
  const containerRef = useRef<HTMLDivElement>();
  const previousActiveTab = usePrevious(activeTab);

  const fullClassName = buildClassName(
    styles.container,
    big && styles.big,
    withBorder && styles.withBorder,
    'no-scrollbar',
    className,
  );

  useHorizontalScroll({
    containerRef,
    shouldPreventDefault: true,
  });

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

    void animateHorizontalScroll(container, newLeft, SCROLL_DURATION);
  }, [activeTab]);

  return (
    <div ref={containerRef} className={fullClassName}>
      {tabs.map((tab, i) => (
        <Tab
          key={tab.title}
          title={tab.title}
          isActive={i === activeTab}
          previousActiveTab={previousActiveTab}
          className={tab?.className}
          menuItems={tab?.menuItems}
          onMenuItemClick={tab?.onMenuItemClick}
          onClick={onSwitchTab}
          clickArg={tab.id}
          icon={tab.icon}
        />
      ))}
    </div>
  );
}

export default memo(TabList);

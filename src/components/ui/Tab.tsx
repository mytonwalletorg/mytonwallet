import React, {
  useEffect, useLayoutEffect, useRef, useState,
} from '../../lib/teact/teact';
import { addExtraClass, removeExtraClass, setExtraStyles } from '../../lib/teact/teact-dom';

import type { IAnchorPosition } from '../../global/types';
import type { DropdownItem } from './Dropdown';

import { requestForcedReflow, requestMutation } from '../../lib/fasterdom/fasterdom';
import buildClassName from '../../util/buildClassName';
import forceReflow from '../../util/forceReflow';

import useLastCallback from '../../hooks/useLastCallback';
import useMenuPosition from '../../hooks/useMenuPosition';

import DropdownMenu from './DropdownMenu';

import styles from './Tab.module.scss';

type OwnProps = {
  className?: string;
  title: string;
  isActive?: boolean;
  previousActiveTab?: number;
  menuItems?: DropdownItem[];
  onClick: (arg: number) => void;
  clickArg: number;
  onMenuItemClick?: (value: string) => void;
};

function Tab({
  className,
  title,
  isActive,
  previousActiveTab,
  menuItems,
  onClick,
  clickArg,
  onMenuItemClick,
}: OwnProps) {
  // eslint-disable-next-line no-null/no-null
  const tabRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const contentRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<IAnchorPosition | undefined>();
  const hasMenu = Boolean(menuItems?.length);
  const isMenuOpen = Boolean(menuPosition);

  const getTriggerElement = useLastCallback(() => contentRef.current);
  const getRootElement = useLastCallback(() => document.body);
  const getMenuElement = useLastCallback(() => document.querySelector('#portals .menu-bubble'));
  const getLayout = useLastCallback(() => ({ withPortal: true }));
  const closeMenu = useLastCallback(() => setMenuPosition(undefined));

  const {
    positionY, transformOriginX, transformOriginY, style: menuStyle,
  } = useMenuPosition(
    menuPosition,
    getTriggerElement,
    getRootElement,
    getMenuElement,
    getLayout,
  );

  const handleClick = useLastCallback(() => {
    if (isActive && !hasMenu) return;

    if (!isActive) {
      onClick(clickArg);
      return;
    }

    if (isMenuOpen) {
      closeMenu();
    } else {
      const { right: x, y, height } = contentRef.current!.getBoundingClientRect();
      setMenuPosition({ x, y: y + height });
    }
  });

  useLayoutEffect(() => {
    // Set initial active state
    if (isActive && previousActiveTab === undefined && tabRef.current) {
      addExtraClass(tabRef.current, styles.Tab_active);
    }
  }, [isActive, previousActiveTab]);

  useEffect(() => {
    if (!isActive || previousActiveTab === undefined) {
      return;
    }

    const tabEl = tabRef.current!;
    const prevTabEl = tabEl.parentElement!.children[previousActiveTab] as HTMLElement;
    if (!prevTabEl) {
      // The number of tabs in the parent component has decreased. It is necessary to add the active tab class name.
      if (isActive && !tabEl.classList.contains(styles.Tab_active)) {
        requestMutation(() => {
          addExtraClass(tabEl, styles.Tab_active);
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
      removeExtraClass(prevPlatformEl, styles.platform_animate);
      removeExtraClass(platformEl, styles.platform_animate);
      setExtraStyles(platformEl, {
        transform:
        `translate3d(${shiftLeft}px, 0, 0) scale3d(${scaleFactor}, 1, 1)`,
      });

      requestForcedReflow(() => {
        forceReflow(platformEl);

        return () => {
          addExtraClass(platformEl, styles.platform_animate);
          setExtraStyles(platformEl, { transform: 'none' });

          removeExtraClass(prevTabEl, styles.Tab_active);
          addExtraClass(tabEl, styles.Tab_active);
        };
      });
    });
  }, [isActive, previousActiveTab]);

  return (
    <div
      className={buildClassName(styles.Tab, className, hasMenu && styles.interactive)}
      onClick={handleClick}
      ref={tabRef}
    >
      <span className={styles.content} ref={contentRef}>
        {title}
        {hasMenu && isActive && <i className="icon-caret-down" aria-hidden />}
        <i className={styles.platform} aria-hidden />
      </span>
      {hasMenu && (
        <DropdownMenu
          isOpen={isMenuOpen}
          items={menuItems!}
          withPortal
          buttonClassName={styles.menuItem}
          menuPositionHorizontal="right"
          menuPosition={positionY}
          menuStyle={menuStyle}
          transformOriginX={transformOriginX}
          transformOriginY={transformOriginY}
          onSelect={onMenuItemClick}
          onClose={closeMenu}
        />
      )}
    </div>
  );
}

export default Tab;

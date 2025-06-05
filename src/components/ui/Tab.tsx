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
  icon?: string;
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
  icon,
}: OwnProps) {
  const tabRef = useRef<HTMLDivElement>();
  const menuRef = useRef<HTMLDivElement>();
  const contentRef = useRef<HTMLDivElement>();
  const [menuAnchor, setMenuAnchor] = useState<IAnchorPosition | undefined>();
  const hasMenu = Boolean(menuItems?.length);
  const isMenuOpen = Boolean(menuAnchor);

  const getTriggerElement = useLastCallback(() => contentRef.current);
  const getRootElement = useLastCallback(() => document.body);
  const getMenuElement = useLastCallback(() => menuRef.current);
  const getLayout = useLastCallback(() => ({ withPortal: true }));
  const closeMenu = useLastCallback(() => setMenuAnchor(undefined));

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
      setMenuAnchor({ x, y: y + height });
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
        {icon && <i className={buildClassName(icon, styles.icon)} aria-hidden />}
        {title}
        {hasMenu && isActive && <i className="icon-caret-down" aria-hidden />}
        <i className={styles.platform} aria-hidden />
      </span>
      {hasMenu && (
        <DropdownMenu
          isOpen={isMenuOpen}
          ref={menuRef}
          items={menuItems}
          withPortal
          buttonClassName={styles.menuItem}
          menuPositionX="right"
          menuAnchor={menuAnchor}
          getTriggerElement={getTriggerElement}
          getRootElement={getRootElement}
          getMenuElement={getMenuElement}
          getLayout={getLayout}
          onSelect={onMenuItemClick}
          onClose={closeMenu}
        />
      )}
    </div>
  );
}

export default Tab;

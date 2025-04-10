import React, {
  memo, useEffect, useRef, useState,
} from '../../lib/teact/teact';

import type { IAnchorPosition } from '../../global/types';
import type { DropdownItem } from './Dropdown';

import buildClassName from '../../util/buildClassName';
import windowSize from '../../util/windowSize';

import useLang from '../../hooks/useLang';
import { usePrevDuringAnimationSimple } from '../../hooks/usePrevDuringAnimationSimple';

import Menu from './Menu';

import styles from './Dropdown.module.scss';

interface OwnProps {
  isOpen: boolean;
  selectedValue?: string;
  items: DropdownItem[];
  withPortal?: boolean;
  anchorPosition?: IAnchorPosition;
  menuPosition?: 'top' | 'bottom';
  menuPositionHorizontal?: 'right' | 'left';
  transformOriginX?: number;
  transformOriginY?: number;
  menuStyle?: string;
  shouldTranslateOptions?: boolean;
  className?: string;
  bubbleClassName?: string;
  buttonClassName?: string;
  iconClassName?: string;
  fontIconClassName?: string;
  shouldCleanup?: boolean;
  onSelect?: (value: string) => void;
  onClose: NoneToVoidFunction;
}

const SAFE_POSITION_PX = 6;

function DropdownMenu({
  isOpen,
  selectedValue,
  items,
  withPortal,
  anchorPosition,
  menuPosition,
  menuPositionHorizontal,
  menuStyle,
  transformOriginX,
  transformOriginY,
  shouldTranslateOptions,
  className,
  bubbleClassName,
  buttonClassName,
  iconClassName,
  fontIconClassName,
  shouldCleanup,
  onSelect,
  onClose,
}: OwnProps) {
  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuLeft, setMenuLeft] = useState(anchorPosition?.x);

  useEffect(() => {
    if (isOpen && menuRef.current && anchorPosition) {
      const menuWidth = menuRef.current.offsetWidth;
      const windowWidth = windowSize.get().width;
      let left = anchorPosition?.x;

      left = Math.min(left, left - menuWidth / 2 - SAFE_POSITION_PX, windowWidth - menuWidth - SAFE_POSITION_PX);
      left = Math.max(left, SAFE_POSITION_PX);

      setMenuLeft(left);
    }
  }, [anchorPosition, isOpen]);

  if (anchorPosition) {
    menuStyle = `${menuStyle || ''};left: ${menuLeft}px; top: ${anchorPosition.y}px;`;
  }

  const prevMenuStyle = usePrevDuringAnimationSimple(menuStyle);

  const handleItemClick = (e: React.MouseEvent, value: string) => {
    e.stopPropagation();
    onSelect?.(value);
    onClose();
  };

  return (
    <Menu
      menuRef={menuRef}
      isOpen={isOpen}
      type="dropdown"
      style={menuStyle || prevMenuStyle}
      withPortal={withPortal}
      positionX={menuPositionHorizontal}
      positionY={menuPosition}
      transformOriginX={transformOriginX}
      transformOriginY={transformOriginY}
      className={className}
      bubbleClassName={bubbleClassName}
      shouldCleanup={shouldCleanup}
      onClose={onClose}
    >
      {items.map((item, index) => {
        const fullButtonClassName = buildClassName(
          styles.item,
          item.icon && styles.item_with_icon,
          item.isDisabled && styles.disabled,
          item.isDangerous && styles.dangerous,
          item.withSeparator && index > 0 && styles.separator,
          selectedValue === item.value && styles.item_selected,
          buttonClassName,
          'capture-scroll',
        );
        return (
          <button
            key={item.value}
            type="button"
            className={fullButtonClassName}
            disabled={item.isDisabled}
            onClick={(e) => handleItemClick(e, item.value)}
          >
            {item.icon && (
              <img src={item.icon} alt="" className={buildClassName('icon', styles.itemIcon, iconClassName)} />
            )}
            {item.overlayIcon && (
              <img src={item.overlayIcon} alt="" className={buildClassName('icon', styles.itemOverlayIcon)} />
            )}
            {item.fontIcon && (
              <i
                className={buildClassName(`icon icon-${item.fontIcon}`, styles.fontIcon, fontIconClassName)}
                aria-hidden
              />
            )}
            <span className={buildClassName(styles.itemName, 'menuItemName')}>
              {shouldTranslateOptions ? lang(item.name) : item.name}
              {item.description && (
                <span className={styles.itemDescription}>
                  {shouldTranslateOptions ? lang(item.description) : item.description}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </Menu>
  );
}

export default memo(DropdownMenu);

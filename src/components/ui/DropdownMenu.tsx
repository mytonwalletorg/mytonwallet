import React, { type ElementRef, memo, useRef } from '../../lib/teact/teact';

import type { IAnchorPosition } from '../../global/types';
import type { DropdownItem } from './Dropdown';
import type { MenuPositionOptions } from './Menu';

import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';

import Menu from './Menu';

import styles from './Dropdown.module.scss';

interface OwnProps<T extends string> {
  isOpen: boolean;
  ref?: ElementRef<HTMLDivElement>;
  selectedValue?: T;
  items: DropdownItem<T>[];
  withPortal?: boolean;
  menuAnchor?: IAnchorPosition;
  menuPositionY?: 'top' | 'bottom';
  menuPositionX?: 'right' | 'left';
  shouldTranslateOptions?: boolean;
  className?: string;
  bubbleClassName?: string;
  buttonClassName?: string;
  iconClassName?: string;
  fontIconClassName?: string;
  itemDescriptionClassName?: string;
  shouldCleanup?: boolean;
  onSelect?: (value: T, e?: React.MouseEvent) => void;
  onClose: NoneToVoidFunction;
  getTriggerElement?: () => HTMLElement | undefined | null;
  getRootElement?: () => HTMLElement | undefined | null;
  getMenuElement?: () => HTMLElement | undefined | null;
  getLayout?: () => { withPortal?: boolean };
  onCloseAnimationEnd?: NoneToVoidFunction;
}

function DropdownMenu<T extends string>({
  isOpen,
  ref,
  selectedValue,
  items,
  withPortal,
  menuAnchor,
  menuPositionX,
  menuPositionY,
  shouldTranslateOptions,
  className,
  bubbleClassName,
  buttonClassName,
  iconClassName,
  fontIconClassName,
  itemDescriptionClassName,
  shouldCleanup,
  onSelect,
  onClose,
  getTriggerElement,
  getRootElement,
  getMenuElement,
  getLayout,
  onCloseAnimationEnd,
}: OwnProps<T>) {
  const lang = useLang();

  let menuRef = useRef<HTMLDivElement>();
  if (ref) {
    menuRef = ref;
  }

  // Create position options
  const menuPositionOptions: MenuPositionOptions = menuAnchor && getTriggerElement && getRootElement && getMenuElement
    ? {
      anchor: menuAnchor,
      getTriggerElement,
      getRootElement,
      getMenuElement,
      getLayout,
    }
    : menuAnchor && getRootElement && getMenuElement
      ? {
        anchor: menuAnchor,
        getRootElement,
        getMenuElement,
        getLayout,
        positionX: menuPositionX,
        positionY: menuPositionY,
      }
      : {
        anchor: menuAnchor,
        positionX: menuPositionX,
        positionY: menuPositionY,
      };

  const handleItemClick = (e: React.MouseEvent, value: T) => {
    e.stopPropagation();
    onSelect?.(value, e);
    onClose();
  };

  return (
    <Menu
      menuRef={menuRef}
      isOpen={isOpen}
      type="dropdown"
      withPortal={withPortal}
      className={className}
      bubbleClassName={bubbleClassName}
      shouldCleanup={shouldCleanup}
      onClose={onClose}
      onCloseAnimationEnd={onCloseAnimationEnd}
      {...menuPositionOptions}
    >
      {items.map((item, index) => {
        const fullButtonClassName = buildClassName(
          styles.item,
          (item.icon || item.fontIcon) && styles.item_with_icon,
          item.isDisabled && styles.disabled,
          item.isDangerous && styles.dangerous,
          item.withDelimiter && index > 0 && styles.delimiter,
          item.withDelimiterAfter && styles.delimiterAfter,
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
              {!!item.description && (
                <span className={buildClassName(styles.itemDescription, itemDescriptionClassName)}>
                  {shouldTranslateOptions && typeof item.description === 'string'
                    ? lang(item.description)
                    : item.description}
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

import React, { memo } from '../../lib/teact/teact';

import type { DropdownItem } from './Dropdown';

import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';

import Menu from './Menu';

import styles from './Dropdown.module.scss';

interface OwnProps {
  isOpen: boolean;
  selectedValue?: string;
  items: DropdownItem[];
  menuPosition?: 'top' | 'bottom';
  menuPositionHorizontal?: 'right' | 'left';
  shouldTranslateOptions?: boolean;
  onSelect?: (value: string) => void;
  onClose: NoneToVoidFunction;
}

function DropdownMenu({
  isOpen,
  selectedValue,
  items,
  menuPosition,
  menuPositionHorizontal,
  shouldTranslateOptions,
  onSelect,
  onClose,
}: OwnProps) {
  const lang = useLang();

  const handleItemClick = (e: React.MouseEvent, value: string) => {
    e.stopPropagation();
    onSelect?.(value);
    onClose();
  };

  return (
    <Menu
      positionX={menuPositionHorizontal}
      positionY={menuPosition}
      isOpen={isOpen}
      onClose={onClose}
      type="dropdown"
    >
      {items.map((item) => {
        const buttonClassName = buildClassName(
          styles.item,
          item.icon && styles.item_with_icon,
          selectedValue === item.value && styles.item_selected,
        );
        return (
          <button
            key={item.value}
            type="button"
            onClick={(e) => handleItemClick(e, item.value)}
            className={buttonClassName}
          >
            {item.icon && <img src={item.icon} alt="" className={styles.itemIcon} />}
            <span className={buildClassName(styles.itemName, 'menuItemName')}>
              {shouldTranslateOptions ? lang(item.name) : item.name}
            </span>
          </button>
        );
      })}
    </Menu>
  );
}

export default memo(DropdownMenu);

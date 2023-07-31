import React, { memo, useMemo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';

import Menu from './Menu';

import styles from './DropDown.module.scss';

export interface DropdownItem {
  value: string;
  name: string;
  icon?: string;
}

interface OwnProps {
  label?: string;
  selectedValue: string;
  items: DropdownItem[];
  className?: string;
  theme?: 'light';
  arrow?: 'caret' | 'chevron';
  menuPosition?: 'top' | 'bottom';
  menuPositionHorizontal?: 'right' | 'left';
  disabled?: boolean;
  shouldTranslateOptions?: boolean;
  onChange?: (value: string) => void;
}

const DEFAULT_ARROW = 'caret';
const DEFAULT_MENU_POSITION_HORIZONTAL = 'right';

function DropDown({
  label,
  items,
  selectedValue,
  className,
  theme,
  arrow = DEFAULT_ARROW,
  menuPosition,
  menuPositionHorizontal = DEFAULT_MENU_POSITION_HORIZONTAL,
  disabled,
  shouldTranslateOptions,
  onChange,
}: OwnProps): TeactJsx {
  const lang = useLang();
  const [isMenuOpen, openMenu, closeMenu] = useFlag();

  const selectedItem = useMemo(() => {
    return items.find((item) => item.value === selectedValue);
  }, [items, selectedValue]);

  const handleItemClick = (e: React.MouseEvent, value: string) => {
    e.stopPropagation();
    onChange?.(value);
    closeMenu();
  };

  if (!items.length) {
    return undefined;
  }

  const buttonArrowIcon = buildClassName(
    styles.buttonIcon,
    arrow === 'chevron' ? 'icon-chevron-down' : 'icon-caret-down',
  );

  const withMenu = items.length > 1;
  const isFullyInteractive = Boolean(label);
  const fullClassName = buildClassName(
    className,
    theme && styles[theme],
    withMenu && styles.interactive,
    isFullyInteractive && styles.wide,
    isFullyInteractive && disabled && styles.disabled,
  );
  const buttonFullClassName = buildClassName(
    styles.button,
    withMenu && styles.interactive,
    !isFullyInteractive && disabled && styles.disabled,
  );

  return (
    <div
      className={fullClassName}
      onClick={isFullyInteractive && !disabled && withMenu ? openMenu : undefined}
    >
      {label && <span className={styles.label}>{label}</span>}
      <button
        type="button"
        className={buttonFullClassName}
        onClick={!isFullyInteractive && withMenu ? openMenu : undefined}
        disabled={disabled}
      >
        {selectedItem?.icon && <img src={selectedItem.icon} alt="" className={styles.itemIcon} />}
        <span className={buildClassName(styles.itemName, 'itemName')}>
          {shouldTranslateOptions ? lang(selectedItem!.name) : selectedItem!.name}
        </span>
        {withMenu && <i className={buttonArrowIcon} />}
      </button>
      {withMenu && (
        <Menu
          positionX={menuPositionHorizontal}
          positionY={menuPosition}
          isOpen={isMenuOpen}
          onClose={closeMenu}
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
      )}
    </div>
  );
}

export default memo(DropDown);

import type { TeactNode } from '../../lib/teact/teact';
import React, { memo, useMemo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import DropdownMenu from './DropdownMenu';
import Spinner from './Spinner';

import styles from './Dropdown.module.scss';

export interface DropdownItem<T extends string = string> {
  value: T;
  name: string;
  selectedName?: string;
  description?: string | TeactNode;
  icon?: string;
  overlayIcon?: string;
  fontIcon?: string;
  isDisabled?: boolean;
  isDangerous?: boolean;
  withDelimiter?: boolean;
  withDelimiterAfter?: boolean;
}

interface OwnProps<T extends string> {
  label?: string;
  selectedValue?: T;
  items: DropdownItem<T>[];
  className?: string;
  itemClassName?: string;
  menuClassName?: string;
  theme?: 'light';
  arrow?: 'caret' | 'chevron';
  menuPositionX?: 'right' | 'left';
  menuPositionY?: 'top' | 'bottom';
  disabled?: boolean;
  shouldTranslateOptions?: boolean;
  onChange?: (value: T) => void;
  isLoading?: boolean;
}

const DEFAULT_ARROW = 'caret';
const DEFAULT_MENU_POSITION_X = 'right';

function Dropdown<T extends string>({
  label,
  items,
  selectedValue,
  className,
  itemClassName,
  menuClassName,
  theme,
  arrow = DEFAULT_ARROW,
  menuPositionX = DEFAULT_MENU_POSITION_X,
  menuPositionY,
  disabled,
  shouldTranslateOptions,
  onChange,
  isLoading = false,
}: OwnProps<T>): TeactJsx {
  const lang = useLang();
  const [isMenuOpen, openMenu, closeMenu] = useFlag();

  const [selectedItem, selectedItemName] = useMemo(() => {
    const item = items.find((i) => selectedValue !== undefined && i.value === selectedValue);
    const selectedName = item?.selectedName ?? item?.name ?? '';
    return [item, selectedName];
  }, [items, selectedValue]);

  const handleSelect = useLastCallback((value: T) => {
    if (value !== selectedValue) {
      onChange?.(value);
    }
  });

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
    withMenu && menuClassName,
    itemClassName,
  );

  return (
    <div
      className={fullClassName}
      onClick={isFullyInteractive && !disabled && withMenu ? openMenu : undefined}
    >
      {label && <span className={styles.label}>{label}</span>}

      {isLoading ? (
        <Spinner className={styles.spinner} />
      ) : (
        <button
          type="button"
          className={buttonFullClassName}
          onClick={!isFullyInteractive && withMenu ? openMenu : undefined}
          disabled={disabled}
        >
          {selectedItem?.icon && <img src={selectedItem.icon} alt="" className={styles.itemIcon} />}
          {selectedItem?.overlayIcon && (
            <img
              src={selectedItem?.overlayIcon}
              alt=""
              className={buildClassName('icon', styles.itemOverlayIcon, styles.insideButton)}
            />
          )}
          {selectedItem?.fontIcon && (
            <i
              className={buildClassName(`icon-${selectedItem.fontIcon}`, styles.fontIcon)}
              aria-hidden
            />
          )}
          <span className={buildClassName(styles.itemName, 'itemName', itemClassName)}>
            {shouldTranslateOptions ? lang(selectedItemName) : selectedItemName}
          </span>
          {withMenu && <i className={buttonArrowIcon} aria-hidden />}
        </button>
      )}

      {withMenu && (
        <DropdownMenu
          isOpen={isMenuOpen && !isLoading}
          menuPositionX={menuPositionX}
          menuPositionY={menuPositionY}
          items={items}
          shouldTranslateOptions={shouldTranslateOptions}
          selectedValue={selectedValue}
          buttonClassName={itemClassName}
          onSelect={handleSelect}
          onClose={closeMenu}
        />
      )}
    </div>
  );
}

export default memo(Dropdown);

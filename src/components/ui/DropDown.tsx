import React, { memo, useMemo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import useFlag from '../../hooks/useFlag';

import Menu from './Menu';

import styles from './DropDown.module.scss';

export interface DropDownItem {
  value: string;
  name: string;
  icon: string;
}

interface OwnProps {
  selectedValue: string;
  items: DropDownItem[];
  className?: string;
  onChange: (value: string) => void;
}

function DropDown({
  items,
  selectedValue,
  className,
  onChange,
}: OwnProps) {
  const [isMenuOpen, openMenu, closeMenu] = useFlag();

  const selectedItem = useMemo(() => {
    return items.find((item) => item.value === selectedValue);
  }, [items, selectedValue]);

  const handleItemClick = (value: string) => {
    onChange(value);
    closeMenu();
  };

  if (!items.length) {
    return undefined;
  }

  return (
    <div className={className}>
      <button type="button" className={styles.button} onClick={openMenu}>
        <img src={selectedItem!.icon} alt="" className={styles.itemIcon} />
        <span className={styles.itemName}>{selectedItem!.name}</span>
        <i className="icon-arrow-down" />
      </button>
      <Menu
        positionX="right"
        isOpen={isMenuOpen}
        onClose={closeMenu}
        bubbleClassName={buildClassName(styles.menu, 'custom-scroll')}
      >
        {items.map((item) => {
          return (
            <button
              type="button"
              onClick={() => handleItemClick(item.value)}
              className={buildClassName(styles.item, selectedValue === item.value && styles.item_selected)}
            >
              {item.icon && <img src={item.icon} alt="" className={styles.itemIcon} />}
              <span className={styles.itemName}>{item.name}</span>
            </button>
          );
        })}
      </Menu>
    </div>
  );
}

export default memo(DropDown);

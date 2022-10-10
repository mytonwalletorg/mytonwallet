import React, { FC, useCallback } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import styles from './MenuItem.module.scss';

type OnClickHandler = (e: React.SyntheticEvent<HTMLDivElement | HTMLAnchorElement>) => void;

interface OwnProps {
  className?: string;
  href?: string;
  children: React.ReactNode;
  onClick?: OnClickHandler;
  isDestructive?: boolean;
  isSeparator?: boolean;
}

const MenuItem: FC<OwnProps> = (props) => {
  const {
    className,
    href,
    children,
    onClick,
    isDestructive,
    isSeparator,
  } = props;

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onClick) {
      e.stopPropagation();
      e.preventDefault();

      return;
    }

    onClick(e);
  }, [onClick]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.code !== 'Enter' && e.code !== 'Space') {
      return;
    }

    if (!onClick) {
      e.stopPropagation();
      e.preventDefault();

      return;
    }

    onClick(e);
  }, [onClick]);

  const fullClassName = buildClassName(
    styles.menuItem,
    className,
    isDestructive && styles.destructive,
    isSeparator && styles.menuItem_separator,
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={fullClassName}>
        {children}
      </a>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={fullClassName}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
};

export default MenuItem;

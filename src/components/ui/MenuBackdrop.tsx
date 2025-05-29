import React, { memo, useLayoutEffect } from '../../lib/teact/teact';
import { toggleExtraClass } from '../../lib/teact/teact-dom';

import buildClassName from '../../util/buildClassName';

import useShowTransition from '../../hooks/useShowTransition';

import styles from './MenuBackdrop.module.scss';

interface OwnProps {
  isMenuOpen?: boolean;
  contentRef: React.RefObject<HTMLElement>;
  contentClassName?: string;
}

function MenuBackdrop({ isMenuOpen, contentRef, contentClassName }: OwnProps) {
  const {
    shouldRender: menuBackdropShouldRender,
    ref: menuBackdropRef,
  } = useShowTransition({
    isOpen: isMenuOpen,
    withShouldRender: true,
  });

  useLayoutEffect(() => {
    if (!contentRef.current) return;

    toggleExtraClass(document.documentElement, 'with-menu-backdrop', isMenuOpen);
    toggleExtraClass(contentRef.current, styles.wrapperVisible, menuBackdropShouldRender);
    toggleExtraClass(contentRef.current, styles.wrapperHide, menuBackdropShouldRender && !isMenuOpen);
    if (contentClassName) {
      toggleExtraClass(contentRef.current, contentClassName, menuBackdropShouldRender);
    }
  }, [contentClassName, contentRef, isMenuOpen, menuBackdropShouldRender]);

  if (!menuBackdropShouldRender) return undefined;

  return (
    <div
      ref={menuBackdropRef}
      className={buildClassName(styles.backdrop, isMenuOpen && styles.visible)}
    />
  );
}

export default memo(MenuBackdrop);

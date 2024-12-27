import type { FC } from '../../lib/teact/teact';
import React, { beginHeavyAnimation, useEffect, useRef } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import stopEvent from '../../util/stopEvent';

import useEffectWithPrevDeps from '../../hooks/useEffectWithPrevDeps';
import useHistoryBack from '../../hooks/useHistoryBack';
import useShowTransition from '../../hooks/useShowTransition';
import useVirtualBackdrop from '../../hooks/useVirtualBackdrop';

import Portal from './Portal';

import styles from './Menu.module.scss';

type OwnProps = {
  children: React.ReactNode;
  isOpen: boolean;
  id?: string;
  className?: string;
  bubbleClassName?: string;
  style?: string;
  type?: 'menu' | 'suggestion' | 'dropdown';
  positionX?: 'left' | 'right';
  positionY?: 'top' | 'bottom';
  transformOriginX?: number;
  transformOriginY?: number;
  autoClose?: boolean;
  shouldSkipTransition?: boolean;
  noBackdrop?: boolean;
  withPortal?: boolean;
  noCloseOnBackdrop?: boolean;
  shouldCleanup?: boolean;
  onCloseAnimationEnd?: () => void;
  onClose?: () => void;
  onMouseEnter?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
};

export const ANIMATION_DURATION = 200;

const Menu: FC<OwnProps> = ({
  children,
  isOpen,
  id,
  className,
  bubbleClassName,
  style,
  positionX = 'left',
  positionY = 'top',
  transformOriginX,
  transformOriginY,
  type = 'menu',
  autoClose = false,
  shouldSkipTransition,
  noBackdrop = false,
  withPortal,
  noCloseOnBackdrop = false,
  shouldCleanup,
  onCloseAnimationEnd,
  onClose,
  onMouseEnter,
  onMouseLeave,
}) => {
  // eslint-disable-next-line no-null/no-null
  const menuRef = useRef<HTMLDivElement>(null);

  useHistoryBack({
    isActive: Boolean(isOpen && onClose),
    onBack: onClose!,
    shouldBeReplaced: true,
  });

  const {
    shouldRender,
    transitionClassNames,
  } = useShowTransition(
    isOpen,
    onCloseAnimationEnd,
    shouldSkipTransition,
    undefined,
    shouldSkipTransition,
  );

  useEffect(
    () => (isOpen && onClose ? captureEscKeyListener(onClose) : undefined),
    [isOpen, onClose],
  );

  useEffectWithPrevDeps(([prevIsOpen]) => {
    if (isOpen || (!isOpen && prevIsOpen === true)) {
      beginHeavyAnimation(ANIMATION_DURATION);
    }
  }, [isOpen]);

  useVirtualBackdrop(isOpen && !noBackdrop, menuRef, noCloseOnBackdrop ? undefined : onClose);

  const fullBubbleClassName = buildClassName(
    styles.bubble,
    bubbleClassName,
    'menu-bubble',
    styles[positionY],
    styles[positionX],
    styles[type],
    transitionClassNames,
  );

  const transformOriginYStyle = transformOriginY !== undefined ? `${transformOriginY}px` : undefined;
  const transformOriginXStyle = transformOriginX !== undefined ? `${transformOriginX}px` : undefined;

  if (shouldCleanup && !shouldRender) {
    return undefined;
  }

  const menu = (
    <div
      id={id}
      className={buildClassName(styles.wrapper, className, withPortal && styles.inPortal)}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={isOpen ? onMouseLeave : undefined}
    >
      {isOpen && !noBackdrop && (
        // This only prevents click events triggering on underlying elements
        <div className={styles.backdrop} onClick={stopEvent} />
      )}
      <div
        ref={menuRef}
        className={fullBubbleClassName}
        style={`transform-origin: ${transformOriginXStyle || positionX} ${transformOriginYStyle || positionY}`}
        onClick={autoClose ? onClose : undefined}
      >
        {children}
      </div>
    </div>
  );

  if (withPortal) {
    return <Portal>{menu}</Portal>;
  }

  return menu;
};

export default Menu;

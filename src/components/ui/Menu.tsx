import React, { FC, useEffect, useRef } from '../../lib/teact/teact';

import useShowTransition from '../../hooks/useShowTransition';
import useVirtualBackdrop from '../../hooks/useVirtualBackdrop';
import useEffectWithPrevDeps from '../../hooks/useEffectWithPrevDeps';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import buildClassName from '../../util/buildClassName';
import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck';
import stopEvent from '../../util/stopEvent';

import styles from './Menu.module.scss';

type OwnProps = {
  children: React.ReactNode;
  isOpen: boolean;
  id?: string;
  className?: string;
  bubbleClassName?: string;
  type?: 'menu' | 'suggestion' | 'dropdown';
  positionX?: 'left' | 'right';
  positionY?: 'top' | 'bottom';
  autoClose?: boolean;
  shouldSkipTransition?: boolean;
  noBackdrop?: boolean;
  noCloseOnBackdrop?: boolean;
  onCloseAnimationEnd?: () => void;
  onClose?: () => void;
  onMouseEnter?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
};

const ANIMATION_DURATION = 200;

const Menu: FC<OwnProps> = ({
  children,
  isOpen,
  id,
  className,
  bubbleClassName,
  positionX = 'left',
  positionY = 'top',
  type = 'menu',
  autoClose = false,
  shouldSkipTransition,
  noBackdrop = false,
  noCloseOnBackdrop = false,
  onCloseAnimationEnd,
  onClose,
  onMouseEnter,
  onMouseLeave,
}) => {
  // eslint-disable-next-line no-null/no-null
  const menuRef = useRef<HTMLDivElement>(null);

  const {
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
      dispatchHeavyAnimationEvent(ANIMATION_DURATION);
    }
  }, [isOpen]);

  useVirtualBackdrop(isOpen && !noBackdrop, menuRef, noCloseOnBackdrop ? undefined : onClose);

  const fullBubbleClassName = buildClassName(
    styles.bubble,
    bubbleClassName,
    'custom-scroll',
    styles[positionY],
    styles[positionX],
    styles[type],
    transitionClassNames,
  );

  return (
    <div
      id={id}
      className={buildClassName(styles.wrapper, className)}
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
        style={`transform-origin: ${positionX} ${positionY}`}
        onClick={autoClose ? onClose : undefined}
      >
        {children}
      </div>
    </div>
  );
};

export default Menu;

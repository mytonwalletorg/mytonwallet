import { RefObject } from 'react';
import React, {
  TeactNode, useCallback, useEffect, useRef,
} from '../../lib/teact/teact';

import { IS_EXTENSION, IS_SINGLE_COLUMN_LAYOUT } from '../../util/environment';
import captureKeyboardListeners from '../../util/captureKeyboardListeners';
import trapFocus from '../../util/trapFocus';
import buildClassName from '../../util/buildClassName';
import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck';
import useShowTransition from '../../hooks/useShowTransition';
import useEffectWithPrevDeps from '../../hooks/useEffectWithPrevDeps';
import useLang from '../../hooks/useLang';

import Button from './Button';
import Portal from './Portal';

import styles from './Modal.module.scss';

type OwnProps = {
  title?: string | TeactNode;
  className?: string;
  dialogClassName?: string;
  contentClassName?: string;
  isOpen?: boolean;
  isCompact?: boolean;
  isSlideUp?: boolean;
  noBackdrop?: boolean;
  noBackdropClose?: boolean;
  header?: any;
  hasCloseButton?: boolean;
  children: React.ReactNode;
  onClose: () => void;
  onCloseAnimationEnd?: () => void;
  onEnter?: () => void;
  dialogRef?: RefObject<HTMLDivElement>;
};

type StateProps = {
  shouldSkipHistoryAnimations?: boolean;
};

const ANIMATION_DURATION = 350;

function Modal({
  dialogRef,
  title,
  className,
  dialogClassName,
  contentClassName,
  isOpen,
  isCompact,
  isSlideUp,
  noBackdrop,
  noBackdropClose,
  header,
  hasCloseButton,
  children,
  onClose,
  onCloseAnimationEnd,
  onEnter,
  shouldSkipHistoryAnimations,
}: OwnProps & StateProps) {
  const {
    shouldRender,
    transitionClassNames,
  } = useShowTransition(
    isOpen, onCloseAnimationEnd, shouldSkipHistoryAnimations, false, shouldSkipHistoryAnimations,
  );

  // eslint-disable-next-line no-null/no-null
  const modalRef = useRef<HTMLDivElement>(null);
  const lang = useLang();

  const handleClose = useCallback((e: KeyboardEvent) => {
    if (IS_EXTENSION) {
      e.preventDefault();
    }

    onClose();
  }, [onClose]);

  useEffect(() => (
    isOpen ? captureKeyboardListeners({ onEsc: handleClose, onEnter }) : undefined
  ), [handleClose, isOpen, onEnter]);
  useEffect(() => (isOpen && modalRef.current ? trapFocus(modalRef.current) : undefined), [isOpen]);

  useEffectWithPrevDeps(([prevIsOpen]) => {
    if (isOpen || (!isOpen && prevIsOpen !== undefined)) {
      dispatchHeavyAnimationEvent(ANIMATION_DURATION);
    }
  }, [isOpen]);

  if (!shouldRender) {
    return undefined;
  }

  function renderHeader() {
    if (header) {
      return header;
    }

    if (!title) {
      return undefined;
    }

    return (
      <div className={buildClassName(styles.header, !hasCloseButton && styles.header_noClose)}>
        <div className={styles.title}>{title}</div>
        {hasCloseButton && (
          <Button
            isRound
            className={styles.closeButton}
            ariaLabel={lang('Close')}
            onClick={onClose}
          >
            <i className={buildClassName(styles.closeIcon, 'icon-close')} aria-hidden />
          </Button>
        )}
      </div>
    );
  }

  const fullClassName = buildClassName(
    styles.modal,
    className,
    transitionClassNames,
    isSlideUp && IS_SINGLE_COLUMN_LAYOUT && styles.slideUp,
    isCompact && styles.compact,
  );

  const backdropFullClass = buildClassName(
    styles.backdrop,
    noBackdrop && styles.noBackdrop,
  );

  const contentFullClassName = buildClassName(
    styles.content,
    isSlideUp && styles.contentSlideUp,
    'custom-scroll',
    contentClassName,
  );

  return (
    <Portal>
      <div
        ref={modalRef}
        className={fullClassName}
        tabIndex={-1}
        role="dialog"
      >
        <div className={styles.container}>
          <div className={backdropFullClass} onClick={!noBackdropClose ? onClose : undefined} />
          <div className={buildClassName(styles.dialog, dialogClassName)} ref={dialogRef}>
            {renderHeader()}
            <div className={contentFullClassName}>
              {children}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}

export default Modal;

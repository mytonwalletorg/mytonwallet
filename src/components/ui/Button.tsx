import type { RefObject } from 'react';
import React, { memo, useCallback, useState } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import styles from './Button.module.scss';

type OwnProps = {
  ref?: RefObject<HTMLButtonElement>;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  forFormId?: string;
  kind?: 'transparent';
  isSubmit?: boolean;
  isPrimary?: boolean;
  isSimple?: boolean;
  isText?: boolean;
  isLoading?: boolean;
  isDisabled?: boolean;
  isRound?: boolean;
  isSmall?: boolean;
  isDestructive?: boolean;
  onClick?: () => void;
};

// Longest animation duration
const CLICKED_TIMEOUT = 400;

function Button({
  ref,
  children,
  className,
  ariaLabel,
  forFormId,
  kind,
  isSubmit,
  isLoading,
  isPrimary,
  isSimple,
  isText,
  isDisabled,
  isRound,
  isSmall,
  isDestructive,
  onClick,
}: OwnProps) {
  const [isClicked, setIsClicked] = useState(false);

  const handleClick = useCallback(() => {
    if (!isDisabled && onClick) {
      onClick();
    }

    setIsClicked(true);
    setTimeout(() => {
      setIsClicked(false);
    }, CLICKED_TIMEOUT);
  }, [isDisabled, onClick]);

  return (
    <button
      ref={ref}
      type={isSubmit || forFormId ? 'submit' : 'button'}
      className={buildClassName(
        styles.button,
        isSimple && styles.isSimple,
        isSmall && styles.sizeSmall,
        isPrimary && styles.primary,
        isDisabled && styles.disabled,
        isLoading && styles.loading,
        isRound && styles.round,
        isText && styles.isText,
        isDestructive && styles.destructive,
        isClicked && styles.clicked,
        className,
        kind && styles[kind],
      )}
      aria-label={ariaLabel}
      onClick={handleClick}
      disabled={isDisabled}
      form={forFormId}
    >
      {isLoading && <span className={styles.buttonText}>{children}</span>}
      {!isLoading && children}
    </button>
  );
}

export default memo(Button);

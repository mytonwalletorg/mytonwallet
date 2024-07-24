import type { RefObject } from 'react';
import React, { memo, useState } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import useLastCallback from '../../hooks/useLastCallback';

import LoadingDots from './LoadingDots';

import styles from './Button.module.scss';

type OwnProps = {
  ref?: RefObject<HTMLButtonElement>;
  children: React.ReactNode;
  id?: string;
  className?: string;
  style?: string;
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
  onClick?: NoneToVoidFunction;
  shouldStopPropagation?: boolean;
};

// Longest animation duration
const CLICKED_TIMEOUT = 400;

function Button({
  ref,
  children,
  id,
  className,
  style,
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
  shouldStopPropagation,
}: OwnProps) {
  const [isClicked, setIsClicked] = useState(false);

  const handleClick = useLastCallback((event: React.MouseEvent) => {
    if (!isDisabled && onClick) {
      if (shouldStopPropagation) {
        event.stopPropagation();
      }
      onClick();
    }

    setIsClicked(true);
    setTimeout(() => {
      setIsClicked(false);
    }, CLICKED_TIMEOUT);
  });

  const loadingClassName = buildClassName(
    isLoading !== undefined && styles.loadingInit,
    isLoading && styles.loadingStart,
  );

  return (
    <button
      id={id}
      ref={ref}
      type={isSubmit || forFormId ? 'submit' : 'button'}
      className={buildClassName(
        styles.button,
        isSimple && styles.isSimple,
        isSmall && styles.sizeSmall,
        isPrimary && styles.primary,
        (isDisabled || isLoading) && styles.disabled,
        loadingClassName,
        isRound && styles.round,
        isText && styles.isText,
        isDestructive && styles.destructive,
        isClicked && styles.clicked,
        className,
        kind && styles[kind],
      )}
      style={style}
      aria-label={ariaLabel}
      onClick={handleClick}
      disabled={isDisabled || isLoading}
      form={forFormId}
    >
      {children}
      <LoadingDots isActive={isLoading} className={styles.loadingDots} />
    </button>
  );
}

export default memo(Button);

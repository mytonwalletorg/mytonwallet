import type { ElementRef } from '../../lib/teact/teact';
import React, { memo, useState } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import { toNativeDigits } from '../../util/nativeDigits';
import { REM } from '../../util/windowEnvironment';
import { calcSafeAreaTop } from '../main/helpers/calcSafeAreaTop';

import useElementVisibility from '../../hooks/useElementVisibility';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import { HEADER_HEIGHT_REM } from '../main/sections/Header/Header';
import Button from '../ui/Button';

import styles from './Header.module.scss';

interface OwnProps {
  isActive: boolean | undefined;
  title?: string;
  topTargetRef?: ElementRef<HTMLDivElement | undefined>;
  withBorder?: boolean;
  backButtonText?: string;
  className?: string;
  forceShowTitle?: boolean;
  actionIcon?: string;
  actionLabel?: string;
  // The action button shows up once this element hides under the header
  actionTargetRef?: ElementRef<HTMLDivElement | undefined>;
  onBackClick: NoneToVoidFunction;
  onActionClick?: NoneToVoidFunction;
}

const INTERSECTION_THRESHOLD = [1];

function Header({
  isActive,
  title,
  topTargetRef,
  withBorder,
  className,
  backButtonText,
  forceShowTitle,
  actionIcon,
  actionLabel,
  actionTargetRef,
  onBackClick,
  onActionClick,
}: OwnProps) {
  const lang = useLang();

  const isTitleAlwaysVisible = !topTargetRef || forceShowTitle;
  const isTitleVisible = useIsScrolledUnderHeader(isActive, topTargetRef, isTitleAlwaysVisible);
  const isActionTargetScrolledUnder = useIsScrolledUnderHeader(isActive, actionTargetRef);
  const isActionVisible = Boolean(onActionClick) && isActionTargetScrolledUnder;
  // If `withBorder` is `undefined`, it means that the border visibility is controlled by `transform`
  const isBorderVisible = withBorder || withBorder === undefined;

  return (
    <div className={buildClassName(styles.root, className)}>
      {(!!title || !!topTargetRef) && (
        <div className={buildClassName(
          styles.background,
          isTitleVisible && styles.backgroundVisible,
          isBorderVisible && styles.backgroundWithBorder,
        )}
        />
      )}
      <Button
        isSimple
        isText
        className={styles.backButton}
        onClick={onBackClick}
      >
        <i className={buildClassName(styles.backIcon, 'icon-chevron-left')} aria-hidden />

        <span>{backButtonText || lang('Back')}</span>
      </Button>

      {!!title && (
        <div
          aria-hidden={!isTitleAlwaysVisible}
          className={buildClassName(styles.title, (isTitleAlwaysVisible || isTitleVisible) && styles.titleVisible)}
        >
          {toNativeDigits(title)}
        </div>
      )}

      {!!actionIcon && (
        <Button
          isSimple
          className={buildClassName(styles.actionButton, isActionVisible && styles.actionButtonVisible)}
          ariaLabel={actionLabel}
          onClick={onActionClick}
        >
          <i className={actionIcon} aria-hidden />
        </Button>
      )}
    </div>
  );
}

export default memo(Header);

function useIsScrolledUnderHeader(
  isActive: boolean | undefined,
  targetRef: ElementRef<HTMLDivElement | undefined> | undefined,
  isInitiallyScrolledUnder = false,
) {
  const [isScrolledUnder, setIsScrolledUnder] = useState(isInitiallyScrolledUnder);
  const intersectionRootMarginTop = HEADER_HEIGHT_REM * REM + calcSafeAreaTop();

  const handleIntersection = useLastCallback((entry: IntersectionObserverEntry) => {
    setIsScrolledUnder(!entry.isIntersecting && entry.boundingClientRect.top - intersectionRootMarginTop < 0);
  });

  useElementVisibility({
    isDisabled: !isActive || !targetRef,
    targetRef,
    rootMargin: `-${intersectionRootMarginTop}px 0px 0px 0px`,
    cb: handleIntersection,
    threshold: INTERSECTION_THRESHOLD,
  });

  return isScrolledUnder;
}

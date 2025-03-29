import React, { memo, useRef } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { SensitiveDataMaskSkin } from '../common/SensitiveDataMask';

import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';
import { stopEvent } from '../../util/domEvents';

import useShowTransition from '../../hooks/useShowTransition';

import SensitiveDataMask from '../common/SensitiveDataMask';

import styles from './SensitiveData.module.scss';

interface OwnProps {
  isActive?: boolean;
  rows: number;
  cols: number;
  cellSize: number;
  align?: 'left' | 'center' | 'right';
  maskSkin?: SensitiveDataMaskSkin;
  shouldHoldSize?: boolean;
  className?: string;
  maskClassName?: string;
  contentClassName?: string;
  children: React.ReactNode;
}

function SensitiveData({
  isActive,
  rows,
  cols,
  cellSize = 0,
  align = 'left',
  maskSkin,
  shouldHoldSize,
  className,
  maskClassName,
  contentClassName,
  children,
}: OwnProps) {
  const { setIsSensitiveDataHidden } = getActions();
  // eslint-disable-next-line no-null/no-null
  const contentRef = useRef<HTMLDivElement>(null);

  // Do not animate on first load with active state
  const {
    shouldRender: shouldRenderSpoiler,
    hasOpenClass: isSpoilerVisible,
  } = useShowTransition(isActive, undefined, isActive);

  function handleClick(e: React.UIEvent) {
    stopEvent(e);

    setIsSensitiveDataHidden({ isHidden: false });
  }

  const fullClassName = buildClassName(
    styles.wrapper,
    className,
    isActive && styles.interactive,
    styles[align],
  );
  const spoilerClassName = buildClassName(
    styles.spoiler,
    !isSpoilerVisible && styles.hidden,
    maskClassName,
    styles[align],
  );
  const wrapperStyle = buildStyle(
    `--spoiler-width: calc(${cellSize * cols}px + var(--sensitive-data-extra-width, 0px))`,
    `min-height: ${cellSize * rows}px`,
    (isActive || shouldHoldSize) && 'min-width: var(--spoiler-width);',
  );
  const contentFullClassName = buildClassName(
    styles.content,
    isActive && styles.hidden,
    contentClassName,
    isActive && isSpoilerVisible && styles.fixedWidth,
  );

  return (
    <div
      style={wrapperStyle}
      className={fullClassName}
      onClick={isActive ? handleClick : undefined}
    >
      {shouldRenderSpoiler && (
        <SensitiveDataMask
          cols={cols}
          rows={rows}
          cellSize={cellSize}
          skin={maskSkin}
          className={spoilerClassName}
        />
      )}
      <div ref={contentRef} className={contentFullClassName}>
        {children}
      </div>
    </div>
  );
}

export default memo(SensitiveData);

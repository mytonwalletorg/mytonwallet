import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useRef,
} from '../../lib/teact/teact';

import type { EmojiIcon } from './Emoji';

import buildClassName from '../../util/buildClassName';
import { stopEvent } from '../../util/domEvents';
import { IS_TOUCH_ENV, REM } from '../../util/windowEnvironment';

import useFlag from '../../hooks/useFlag';
import useLastCallback from '../../hooks/useLastCallback';
import useShowTransition from '../../hooks/useShowTransition';
import useUniqueId from '../../hooks/useUniqueId';

import Emoji from './Emoji';
import Portal from './Portal';

import styles from './IconWithTooltip.module.scss';

type OwnProps = {
  message: React.ReactNode;
  emoji?: EmojiIcon;
  size?: 'small' | 'medium';
  type?: 'hint' | 'warning';
  iconClassName?: string;
  tooltipClassName?: string;
};

const ARROW_WIDTH = 0.6875 * REM;
const GAP = 2 * REM;

/** The component is designed to be positioned inline in text. Use a space symbol to create a gap on the left. */
const IconWithTooltip: FC<OwnProps> = ({
  message,
  emoji,
  size = 'medium',
  type = 'hint',
  iconClassName,
  tooltipClassName,
}) => {
  const [isOpen, open, close] = useFlag();
  const { transitionClassNames, shouldRender } = useShowTransition(isOpen);
  const colorClassName = type === 'warning' && styles[`color-${type}`];

  // eslint-disable-next-line no-null/no-null
  const iconRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line no-null/no-null
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const tooltipStyle = useRef<string | undefined>();
  const arrowStyle = useRef<string | undefined>();

  const randomTooltipKey = useUniqueId();

  const handleClickOutside = useLastCallback((event: Event) => {
    if (!(event.target as HTMLElement).closest(`[data-tooltip-key="${randomTooltipKey}"]`)) {
      close();
    }
  });

  useEffect(() => {
    if (!isOpen) return undefined;
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, close, handleClickOutside]);

  useEffect(() => {
    if (!iconRef.current || !tooltipRef.current) return;

    const { top, left, width } = iconRef.current.getBoundingClientRect();
    const {
      width: tooltipWidth,
      height: tooltipHeight,
    } = tooltipRef.current.getBoundingClientRect();

    const tooltipCenter = (window.innerWidth - tooltipWidth) / 2;
    const arrowPosition = left - tooltipCenter + width / 2 - ARROW_WIDTH / 2;
    const horizontalOffset = arrowPosition < GAP ? GAP - arrowPosition : 0;

    const tooltipVerticalStyle = `top: ${top - tooltipHeight - ARROW_WIDTH}px;`;
    const tooltipHorizontalStyle = `left: ${tooltipCenter - horizontalOffset}px;`;
    const arrowHorizontalStyle = `left: ${arrowPosition + horizontalOffset}px;`;
    const arrowVerticalStyle = `top: ${tooltipHeight - ARROW_WIDTH / 2 - 1}px;`;

    tooltipStyle.current = `${tooltipVerticalStyle} ${tooltipHorizontalStyle}`;
    arrowStyle.current = `${arrowVerticalStyle} ${arrowHorizontalStyle}`;
  }, [shouldRender]);

  function renderIcon() {
    const commonClassName = buildClassName(styles.icon, iconClassName, styles[size], colorClassName);
    const onClick = IS_TOUCH_ENV ? stopEvent : undefined;

    if (emoji) {
      return (
        <span
          ref={iconRef}
          className={commonClassName}
          data-tooltip-key={randomTooltipKey}
          onClick={onClick}
          onMouseEnter={open}
          onMouseLeave={close}
        >
          <Emoji from={emoji} />
        </span>
      );
    }

    return (
      <i
        ref={iconRef}
        className={buildClassName(
          commonClassName,
          styles.fontIcon,
          type === 'warning' ? 'icon-exclamation' : 'icon-question',
        )}
        data-tooltip-key={randomTooltipKey}
        onClick={onClick}
        onMouseEnter={open}
        onMouseLeave={close}
      />
    );
  }

  return (
    <>
      {shouldRender && (
        <Portal>
          <div
            className={buildClassName(styles.container, transitionClassNames)}
            onClick={stopEvent}
            style={tooltipStyle.current}
          >
            <div
              ref={tooltipRef}
              className={buildClassName(styles.tooltip, styles[size], colorClassName, tooltipClassName)}
            >
              {message}
            </div>
            <div className={styles.arrow} style={arrowStyle.current} />
          </div>
        </Portal>
      )}
      {renderIcon()}
    </>
  );
};

export default memo(IconWithTooltip);

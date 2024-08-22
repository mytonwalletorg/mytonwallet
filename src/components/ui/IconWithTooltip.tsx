import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useRef,
} from '../../lib/teact/teact';

import type { EmojiIcon } from './Emoji';

import buildClassName from '../../util/buildClassName';
import stopEvent from '../../util/stopEvent';
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
  iconClassName?: string;
  tooltipClassName?: string;
};

const ARROW_WIDTH = 0.6875 * REM;
const GAP = 2 * REM;

const IconWithTooltip: FC<OwnProps> = ({
  message,
  emoji,
  iconClassName,
  tooltipClassName,
}) => {
  const [isOpen, open, close] = useFlag();
  const { transitionClassNames, shouldRender } = useShowTransition(isOpen);

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
    if (emoji) {
      return (
        <div
          ref={iconRef}
          className={buildClassName(styles.icon, iconClassName)}
          onClick={IS_TOUCH_ENV ? stopEvent : undefined}
          onMouseEnter={open}
          onMouseLeave={close}
        >
          <Emoji from={emoji} />
        </div>
      );
    }

    return (
      <i
        ref={iconRef}
        className={buildClassName(styles.icon, 'icon-question', iconClassName)}
        onClick={IS_TOUCH_ENV ? stopEvent : undefined}
        onMouseEnter={open}
        onMouseLeave={close}
      />
    );
  }

  return (
    <div className={styles.wrapper} data-tooltip-key={randomTooltipKey}>
      {shouldRender && (
        <Portal>
          <div
            className={buildClassName(styles.container, transitionClassNames)}
            onClick={stopEvent}
            style={tooltipStyle.current}
          >
            <div
              ref={tooltipRef}
              className={buildClassName(styles.tooltip, tooltipClassName)}
            >
              {message}
            </div>
            <div className={styles.arrow} style={arrowStyle.current} />
          </div>
        </Portal>
      )}
      {renderIcon()}
    </div>
  );
};

export default memo(IconWithTooltip);

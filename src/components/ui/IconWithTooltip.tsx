import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useRef,
} from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import stopEvent from '../../util/stopEvent';
import { IS_TOUCH_ENV, REM } from '../../util/windowEnvironment';

import useFlag from '../../hooks/useFlag';
import useShowTransition from '../../hooks/useShowTransition';

import Portal from './Portal';

import styles from './IconWithTooltip.module.scss';

type OwnProps = {
  message: React.ReactNode;
  iconClassName?: string;
  tooltipClassName?: string;
};

const ARROW_WIDTH = 0.6875 * REM;

const IconWithTooltip: FC<OwnProps> = ({
  message,
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

  useEffect(() => {
    if (!iconRef.current || !tooltipRef.current) return;

    const { top, left, width } = iconRef.current.getBoundingClientRect();
    const {
      width: tooltipWidth,
      height: tooltipHeight,
    } = tooltipRef.current.getBoundingClientRect();

    const tooltipCenter = (window.innerWidth - tooltipWidth) / 2;
    const tooltipVerticalStyle = `top: ${top - tooltipHeight - ARROW_WIDTH}px;`;
    const tooltipHorizontalStyle = `left: ${tooltipCenter}px;`;
    const arrowHorizontalStyle = `left: ${left - tooltipCenter + width / 2 - ARROW_WIDTH / 2}px;`;
    const arrowVerticalStyle = `top: ${tooltipHeight - ARROW_WIDTH / 2 - 1}px;`;

    tooltipStyle.current = `${tooltipVerticalStyle} ${tooltipHorizontalStyle}`;
    arrowStyle.current = `${arrowVerticalStyle} ${arrowHorizontalStyle}`;
  }, [shouldRender]);

  return (
    <div className={styles.wrapper}>
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
      <i
        ref={iconRef}
        className={buildClassName('icon-question', iconClassName)}
        onClick={IS_TOUCH_ENV ? stopEvent : undefined}
        onMouseEnter={open}
        onMouseLeave={close}
      />
    </div>
  );
};

export default memo(IconWithTooltip);

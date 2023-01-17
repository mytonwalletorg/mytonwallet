import React, { FC, memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import stopEvent from '../../util/stopEvent';
import useShowTransition from '../../hooks/useShowTransition';

import styles from './Tooltip.module.scss';

type OwnProps = {
  isOpen?: boolean;
  message: string;
  className?: string;
};

const Tooltip: FC<OwnProps> = ({
  isOpen,
  message,
  className,
}) => {
  const { transitionClassNames, shouldRender } = useShowTransition(isOpen);

  if (!shouldRender) {
    return undefined;
  }

  return (
    <div className={buildClassName(styles.container, transitionClassNames)} onClick={stopEvent}>
      <div className={buildClassName(styles.tooltip, className)}>
        {message}
      </div>
    </div>
  );
};

export default memo(Tooltip);

import React, {
  FC, useCallback, useEffect, useRef, useState,
} from '../../lib/teact/teact';

import useShowTransition from '../../hooks/useShowTransition';
import buildClassName from '../../util/buildClassName';
import captureEscKeyListener from '../../util/captureEscKeyListener';

import Portal from './Portal';

import styles from './Notification.module.scss';

type OwnProps = {
  containerId?: string;
  message: string;
  icon?: string;
  onDismiss: () => void;
};

const DURATION_MS = 5000;
const ANIMATION_DURATION = 250;

const Notification: FC<OwnProps> = ({
  icon, message, containerId, onDismiss,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  // eslint-disable-next-line no-null/no-null
  const timerRef = useRef<number | undefined>(null);

  const { transitionClassNames } = useShowTransition(isOpen);

  const closeAndDismiss = useCallback(() => {
    setIsOpen(false);
    setTimeout(onDismiss, ANIMATION_DURATION);
  }, [onDismiss]);

  useEffect(() => (isOpen ? captureEscKeyListener(closeAndDismiss) : undefined), [isOpen, closeAndDismiss]);

  useEffect(() => {
    timerRef.current = window.setTimeout(closeAndDismiss, DURATION_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
    };
  }, [closeAndDismiss]);

  const handleMouseEnter = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    timerRef.current = window.setTimeout(closeAndDismiss, DURATION_MS);
  }, [closeAndDismiss]);

  return (
    <Portal className={styles.container} containerId={containerId}>
      <div
        className={buildClassName(styles.notification, transitionClassNames)}
        onClick={closeAndDismiss}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className={styles.content}>
          {icon && <i className={buildClassName(styles.icon, icon)} aria-hidden />}
          {message}
        </div>
      </div>
    </Portal>
  );
};

export default Notification;

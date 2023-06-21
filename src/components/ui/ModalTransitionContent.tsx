import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import styles from './Modal.module.scss';

type Props = {
  className?: string;
  children: React.ReactNode;
};

function ModalTransitionContent({ className, children }: Props) {
  return <div className={buildClassName(styles.transitionContent, className)}>{children}</div>;
}

export default memo(ModalTransitionContent);

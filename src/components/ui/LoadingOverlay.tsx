import React, { memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { TransferState } from '../../global/types';

import buildClassName from '../../util/buildClassName';

import useShowTransition from '../../hooks/useShowTransition';

import Portal from './Portal';
import Spinner from './Spinner';

import styles from './LoadingOverlay.module.scss';

type StateProps = {
  isOpen?: boolean;
};

function LoadingOverlay({ isOpen }: StateProps) {
  const { closeLoadingOverlay } = getActions();

  const { shouldRender, transitionClassNames } = useShowTransition(isOpen);

  if (!shouldRender) return undefined;

  return (
    <Portal>
      <div className={buildClassName(styles.root, transitionClassNames)} onClick={() => closeLoadingOverlay()}>
        <Spinner color="white" />
      </div>
    </Portal>
  );
}

export default memo(withGlobal(
  (global) => {
    const isDpppModalOpen = (
      global.dappConnectRequest?.state !== undefined || global.currentDappTransfer.state !== TransferState.None
    );

    return {
      isOpen: global.isLoadingOverlayOpen && !isDpppModalOpen,
    };
  },
)(LoadingOverlay));

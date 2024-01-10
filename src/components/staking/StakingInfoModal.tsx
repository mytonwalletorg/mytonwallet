import React, { memo, useEffect } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { selectCurrentAccountState } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';

import useForceUpdate from '../../hooks/useForceUpdate';
import useInterval from '../../hooks/useInterval';

import Modal from '../ui/Modal';
import StakingInfoContent from './StakingInfoContent';

import styles from './Staking.module.scss';

interface OwnProps {
  isOpen?: boolean;
  onClose: NoneToVoidFunction;
}

interface StateProps {
  isUnstakeRequested?: boolean;
  hasHistory?: boolean;
}

const UPDATE_UNSTAKE_DATE_INTERVAL_MS = 30000; // 30 sec

function StakingInfoModal({
  isOpen,
  isUnstakeRequested,
  hasHistory,
  onClose,
}: OwnProps & StateProps) {
  const { fetchStakingHistory } = getActions();

  const forceUpdate = useForceUpdate();

  useInterval(forceUpdate, isUnstakeRequested ? UPDATE_UNSTAKE_DATE_INTERVAL_MS : undefined);

  useEffect(() => {
    if (isOpen) {
      fetchStakingHistory();
    }
  }, [fetchStakingHistory, isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      contentClassName={buildClassName(styles.stakingInfoModalContent)}
      nativeBottomSheetKey="staking-info"
      onClose={onClose}
      forceFullNative={hasHistory}
    >
      <StakingInfoContent isActive={isOpen} onClose={onClose} />
    </Modal>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const accountState = selectCurrentAccountState(global);

  return {
    isUnstakeRequested: accountState?.staking?.isUnstakeRequested,
    hasHistory: accountState?.stakingHistory && accountState.stakingHistory.length > 0,
  };
})(StakingInfoModal));

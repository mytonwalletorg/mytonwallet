import React, { memo, useEffect } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { selectAccountStakingHistory } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';

import Modal from '../ui/Modal';
import StakingInfoContent from './StakingInfoContent';

import styles from './Staking.module.scss';

interface OwnProps {
  isOpen?: boolean;
  onClose: NoneToVoidFunction;
}

interface StateProps {
  hasHistory?: boolean;
}

function StakingInfoModal({
  isOpen,
  hasHistory,
  onClose,
}: OwnProps & StateProps) {
  const { fetchStakingHistory } = getActions();

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
  const stakingHistory = global.currentAccountId
    ? selectAccountStakingHistory(global, global.currentAccountId)
    : undefined;

  return {
    hasHistory: Boolean(stakingHistory?.length),
  };
})(StakingInfoModal));

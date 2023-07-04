import React, {
  memo, useCallback, useEffect, useState,
} from '../../lib/teact/teact';

import { getActions, withGlobal } from '../../global';
import { selectCurrentAccountState } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';

import { useDeviceScreen } from '../../hooks/useDeviceScreen';
import useFlag from '../../hooks/useFlag';

import StakeModal from '../staking/StakeModal';
import StakingInfoModal from '../staking/StakingInfoModal';
import UnstakingModal from '../staking/UnstakeModal';
import { LandscapeActions, PortraitActions } from './sections/Actions';
import Card from './sections/Card';
import Content from './sections/Content';
import Warnings from './sections/Warnings';

import styles from './Main.module.scss';

type StateProps = {
  currentTokenSlug?: string;
  currentAccountId?: string;
  isStakingActive: boolean;
  isUnstakeRequested?: boolean;
};

function Main({
  currentTokenSlug, currentAccountId, isStakingActive, isUnstakeRequested,
}: StateProps) {
  const {
    selectToken,
    startStaking,
    fetchBackendStakingState,
    openBackupWalletModal,
  } = getActions();

  const [activeTabIndex, setActiveTabIndex] = useState<number>(currentTokenSlug ? 1 : 0);
  const [isStakingInfoOpened, openStakingInfo, closeStakingInfo] = useFlag(false);
  const { isPortrait } = useDeviceScreen();

  useEffect(() => {
    if (currentAccountId && (isStakingActive || isUnstakeRequested)) {
      fetchBackendStakingState();
    }
  }, [fetchBackendStakingState, currentAccountId, isStakingActive, isUnstakeRequested]);

  const handleTokenCardClose = useCallback(() => {
    selectToken({ slug: undefined });
    setActiveTabIndex(0);
  }, [selectToken]);

  const handleEarnClick = useCallback(() => {
    if (isStakingActive || isUnstakeRequested) {
      openStakingInfo();
    } else {
      startStaking();
    }
  }, [isStakingActive, isUnstakeRequested, openStakingInfo, startStaking]);

  function renderPortraitLayout() {
    return (
      <div className={styles.portraitContainer}>
        <div className={styles.head}>
          <Warnings onOpenBackupWallet={openBackupWalletModal} />
          <Card onTokenCardClose={handleTokenCardClose} onApyClick={handleEarnClick} />
          <PortraitActions
            hasStaking={isStakingActive}
            isUnstakeRequested={isUnstakeRequested}
            onEarnClick={handleEarnClick}
          />
        </div>

        <Content
          activeTabIndex={activeTabIndex}
          setActiveTabIndex={setActiveTabIndex}
          onStakedTokenClick={handleEarnClick}
        />
      </div>
    );
  }

  function renderLandscapeLayout() {
    return (
      <div className={styles.landscapeContainer}>
        <div className={buildClassName(styles.sidebar, 'custom-scroll')}>
          <Warnings onOpenBackupWallet={openBackupWalletModal} />
          <Card onTokenCardClose={handleTokenCardClose} onApyClick={handleEarnClick} />
          <LandscapeActions
            hasStaking={isStakingActive}
            isUnstakeRequested={isUnstakeRequested}
          />
        </div>
        <div className={styles.main}>
          <Content
            activeTabIndex={activeTabIndex}
            setActiveTabIndex={setActiveTabIndex}
            onStakedTokenClick={handleEarnClick}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      {isPortrait ? renderPortraitLayout() : renderLandscapeLayout()}

      <StakeModal onViewStakingInfo={openStakingInfo} />
      <StakingInfoModal isOpen={isStakingInfoOpened} onClose={closeStakingInfo} />
      <UnstakingModal />
    </>
  );
}

export default memo(
  withGlobal((global, ownProps, detachWhenChanged): StateProps => {
    detachWhenChanged(global.currentAccountId);
    const accountState = selectCurrentAccountState(global);

    return {
      isStakingActive: Boolean(accountState?.stakingBalance) && !accountState?.isUnstakeRequested,
      isUnstakeRequested: accountState?.isUnstakeRequested,
      currentTokenSlug: accountState?.currentTokenSlug,
      currentAccountId: global.currentAccountId,
    };
  })(Main),
);

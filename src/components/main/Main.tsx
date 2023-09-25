import React, {
  memo, useEffect, useRef, useState,
} from '../../lib/teact/teact';

import { ContentTab } from '../../global/types';

import { getActions, withGlobal } from '../../global';
import { selectCurrentAccount, selectCurrentAccountState } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { REM } from '../../util/windowEnvironment';

import { useDeviceScreen } from '../../hooks/useDeviceScreen';
import useFlag from '../../hooks/useFlag';
import useLastCallback from '../../hooks/useLastCallback';
import useShowTransition from '../../hooks/useShowTransition';

import ReceiveModal from '../receive/ReceiveModal';
import StakeModal from '../staking/StakeModal';
import StakingInfoModal from '../staking/StakingInfoModal';
import UnstakingModal from '../staking/UnstakeModal';
import { LandscapeActions, PortraitActions } from './sections/Actions';
import Card from './sections/Card';
import StickyCard from './sections/Card/StickyCard';
import Content from './sections/Content';
import Warnings from './sections/Warnings';

import styles from './Main.module.scss';

type StateProps = {
  currentTokenSlug?: string;
  currentAccountId?: string;
  isStakingActive: boolean;
  isUnstakeRequested?: boolean;
  isTestnet?: boolean;
  isLedger?: boolean;
};

const STICKY_CARD_INTERSECTION_THRESHOLD = -3.75 * REM;

function Main({
  currentTokenSlug, currentAccountId, isStakingActive, isUnstakeRequested, isTestnet, isLedger,
}: StateProps) {
  const {
    selectToken,
    startStaking,
    fetchBackendStakingState,
    openBackupWalletModal,
    setActiveContentTabIndex,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const cardRef = useRef<HTMLDivElement>(null);
  const [canRenderStickyCard, setCanRenderStickyCard] = useState(false);
  const [isStakingInfoOpened, openStakingInfo, closeStakingInfo] = useFlag(false);
  const [isReceiveModalOpened, openReceiveModal, closeReceiveModal] = useFlag(false);
  const { isPortrait } = useDeviceScreen();
  const {
    shouldRender: shouldRenderStickyCard,
    transitionClassNames: stickyCardTransitionClassNames,
  } = useShowTransition(canRenderStickyCard);

  useEffect(() => {
    if (currentAccountId && (isStakingActive || isUnstakeRequested)) {
      fetchBackendStakingState();
    }
  }, [fetchBackendStakingState, currentAccountId, isStakingActive, isUnstakeRequested]);

  useEffect(() => {
    if (currentTokenSlug) {
      setActiveContentTabIndex({ index: ContentTab.Activity });
    }
  }, [currentTokenSlug]);

  useEffect(() => {
    if (!isPortrait) {
      setCanRenderStickyCard(false);
      return undefined;
    }

    const observer = new IntersectionObserver((entries) => {
      const { isIntersecting, boundingClientRect: { left, width } } = entries[0];
      setCanRenderStickyCard(entries.length > 0 && !isIntersecting && left >= 0 && left < width);
    }, { rootMargin: `${STICKY_CARD_INTERSECTION_THRESHOLD}px 0px 0px` });
    const cardElement = cardRef.current;

    if (cardElement) {
      observer.observe(cardElement);
    }

    return () => {
      if (cardElement) {
        observer.unobserve(cardElement);
      }
    };
  }, [isPortrait]);

  const handleTokenCardClose = useLastCallback(() => {
    selectToken({ slug: undefined });
    setActiveContentTabIndex({ index: ContentTab.Assets });
  });

  const handleEarnClick = useLastCallback(() => {
    if (isStakingActive || isUnstakeRequested) {
      openStakingInfo();
    } else {
      startStaking();
    }
  });

  function renderPortraitLayout() {
    return (
      <div className={styles.portraitContainer}>
        <div className={styles.head}>
          <Warnings onOpenBackupWallet={openBackupWalletModal} />
          <Card ref={cardRef} onTokenCardClose={handleTokenCardClose} onApyClick={handleEarnClick} />
          {shouldRenderStickyCard && <StickyCard classNames={stickyCardTransitionClassNames} />}
          <PortraitActions
            hasStaking={isStakingActive}
            isTestnet={isTestnet}
            isUnstakeRequested={isUnstakeRequested}
            onEarnClick={handleEarnClick}
            onReceiveClick={openReceiveModal}
            isLedger={isLedger}
          />
        </div>

        <Content onStakedTokenClick={handleEarnClick} />
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
            isLedger={isLedger}
          />
        </div>
        <div className={styles.main}>
          <Content onStakedTokenClick={handleEarnClick} />
        </div>
      </div>
    );
  }

  return (
    <>
      {isPortrait ? renderPortraitLayout() : renderLandscapeLayout()}

      <StakeModal onViewStakingInfo={openStakingInfo} />
      <StakingInfoModal isOpen={isStakingInfoOpened} onClose={closeStakingInfo} />
      <ReceiveModal isOpen={isReceiveModalOpened} onClose={closeReceiveModal} />
      <UnstakingModal />
    </>
  );
}

export default memo(
  withGlobal((global, ownProps, detachWhenChanged): StateProps => {
    detachWhenChanged(global.currentAccountId);
    const accountState = selectCurrentAccountState(global);
    const account = selectCurrentAccount(global);

    return {
      isStakingActive: Boolean(accountState?.stakingBalance) && !accountState?.isUnstakeRequested,
      isUnstakeRequested: accountState?.isUnstakeRequested,
      currentTokenSlug: accountState?.currentTokenSlug,
      currentAccountId: global.currentAccountId,
      isTestnet: global.settings.isTestnet,
      isLedger: !!account?.ledger,
    };
  })(Main),
);

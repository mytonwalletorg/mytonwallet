import React, {
  memo, useEffect, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiStakingState } from '../../api/types';
import { ActiveTab, ContentTab, type Theme } from '../../global/types';

import { IS_CAPACITOR, IS_CORE_WALLET } from '../../config';
import {
  selectAccountStakingState,
  selectCurrentAccount,
  selectCurrentAccountSettings,
  selectCurrentAccountState,
  selectIsCurrentAccountViewMode,
  selectIsStakingDisabled,
  selectIsSwapDisabled,
} from '../../global/selectors';
import { useAccentColor } from '../../util/accentColor';
import buildClassName from '../../util/buildClassName';
import { getStatusBarHeight } from '../../util/capacitor';
import { captureEvents, SwipeDirection } from '../../util/captureEvents';
import { getStakingStateStatus } from '../../util/staking';
import { setStatusBarStyle } from '../../util/switchTheme';
import {
  IS_DELEGATED_BOTTOM_SHEET, IS_ELECTRON, IS_TOUCH_ENV, STICKY_CARD_INTERSECTION_THRESHOLD,
} from '../../util/windowEnvironment';
import windowSize from '../../util/windowSize';

import useAppTheme from '../../hooks/useAppTheme';
import useBackgroundMode, { isBackgroundModeActive } from '../../hooks/useBackgroundMode';
import { useOpenFromMainBottomSheet } from '../../hooks/useDelegatedBottomSheet';
import { useDeviceScreen } from '../../hooks/useDeviceScreen';
import useEffectOnce from '../../hooks/useEffectOnce';
import useFlag from '../../hooks/useFlag';
import useInterval from '../../hooks/useInterval';
import useLastCallback from '../../hooks/useLastCallback';
import usePreventPinchZoomGesture from '../../hooks/usePreventPinchZoomGesture';
import useShowTransition from '../../hooks/useShowTransition';

import LinkingDomainModal from '../domain/LinkingDomainModal';
import RenewDomainModal from '../domain/RenewDomainModal';
import InvoiceModal from '../receive/InvoiceModal';
import ReceiveModal from '../receive/ReceiveModal';
import StakeModal from '../staking/StakeModal';
import StakingClaimModal from '../staking/StakingClaimModal';
import StakingInfoModal from '../staking/StakingInfoModal';
import UnstakeModal from '../staking/UnstakeModal';
import UpdateAvailable from '../ui/UpdateAvailable';
import VestingModal from '../vesting/VestingModal';
import VestingPasswordModal from '../vesting/VestingPasswordModal';
import { LandscapeActions, PortraitActions } from './sections/Actions';
import Card from './sections/Card';
import StickyCard from './sections/Card/StickyCard';
import Content from './sections/Content';
import Warnings from './sections/Warnings';

import styles from './Main.module.scss';

interface OwnProps {
  isActive?: boolean;
}

type StateProps = {
  currentTokenSlug?: string;
  stakingState?: ApiStakingState;
  isTestnet?: boolean;
  isLedger?: boolean;
  isViewMode?: boolean;
  isStakingInfoModalOpen?: boolean;
  isSwapDisabled?: boolean;
  isStakingDisabled?: boolean;
  isOnRampDisabled?: boolean;
  isMediaViewerOpen?: boolean;
  theme: Theme;
  accentColorIndex?: number;
};

const UPDATE_SWAPS_INTERVAL_NOT_FOCUSED = 15000; // 15 sec
const UPDATE_SWAPS_INTERVAL = 3000; // 3 sec

function Main({
  isActive,
  currentTokenSlug,
  stakingState,
  isTestnet,
  isViewMode,
  isLedger,
  isStakingInfoModalOpen,
  isSwapDisabled,
  isStakingDisabled,
  isOnRampDisabled,
  isMediaViewerOpen,
  theme,
  accentColorIndex,
}: OwnProps & StateProps) {
  const {
    selectToken,
    openBackupWalletModal,
    setActiveContentTab,
    closeStakingInfo,
    openStakingInfoOrStart,
    changeCurrentStaking,
    setLandscapeActionsActiveTabIndex,
    loadExploreSites,
    openReceiveModal,
    updatePendingSwaps,
  } = getActions();

  const cardRef = useRef<HTMLDivElement>();
  const portraitContainerRef = useRef<HTMLDivElement>();
  const landscapeContainerRef = useRef<HTMLDivElement>();

  const [canRenderStickyCard, setCanRenderStickyCard] = useState(false);
  const [shouldRenderDarkStatusBar, setShouldRenderDarkStatusBar] = useState(false);
  const safeAreaTop = IS_CAPACITOR ? getStatusBarHeight() : windowSize.get().safeAreaTop;
  const [isFocused, markIsFocused, unmarkIsFocused] = useFlag(!isBackgroundModeActive());

  const stakingStatus = stakingState ? getStakingStateStatus(stakingState) : 'inactive';

  useBackgroundMode(unmarkIsFocused, markIsFocused);

  useOpenFromMainBottomSheet('receive', openReceiveModal);
  usePreventPinchZoomGesture(isMediaViewerOpen);

  const { isPortrait, isLandscape } = useDeviceScreen();
  const {
    shouldRender: shouldRenderStickyCard,
    ref: stickyCardRef,
  } = useShowTransition({
    isOpen: canRenderStickyCard,
    withShouldRender: true,
  });

  useEffectOnce(() => {
    if (IS_CORE_WALLET) return;

    loadExploreSites({ isLandscape });
  });

  useEffect(() => {
    setStatusBarStyle({
      forceDarkBackground: shouldRenderDarkStatusBar,
    });
  }, [shouldRenderDarkStatusBar]);

  useInterval(updatePendingSwaps, isFocused ? UPDATE_SWAPS_INTERVAL : UPDATE_SWAPS_INTERVAL_NOT_FOCUSED);

  useEffect(() => {
    if (!isPortrait || !isActive) {
      setCanRenderStickyCard(false);
      return undefined;
    }

    const rootMarginTop = STICKY_CARD_INTERSECTION_THRESHOLD - safeAreaTop;
    const observer = new IntersectionObserver((entries) => {
      const { isIntersecting, boundingClientRect: { left, width } } = entries[0];
      setCanRenderStickyCard(entries.length > 0 && !isIntersecting && left < width);
    }, { rootMargin: `${rootMarginTop}px 0px 0px` });

    const cardTopSideObserver = new IntersectionObserver((entries) => {
      const { isIntersecting } = entries[0];

      setShouldRenderDarkStatusBar(!isIntersecting);
    }, { rootMargin: `-${safeAreaTop}px 0px 0px`, threshold: [1] });
    const cardElement = cardRef.current;

    if (cardElement) {
      observer.observe(cardElement);
      cardTopSideObserver.observe(cardElement);
    }

    return () => {
      if (cardElement) {
        observer.unobserve(cardElement);
        cardTopSideObserver.unobserve(cardElement);
        setShouldRenderDarkStatusBar(false);
      }
    };
  }, [isActive, isPortrait, safeAreaTop]);

  const handleTokenCardClose = useLastCallback(() => {
    selectToken({ slug: undefined });
    setActiveContentTab({ tab: ContentTab.Assets });
  });

  useEffect(() => {
    if (!IS_TOUCH_ENV || !isPortrait || !portraitContainerRef.current || !currentTokenSlug) {
      return undefined;
    }

    return captureEvents(portraitContainerRef.current, {
      excludedClosestSelector: '.token-card',
      onSwipe: (e, direction) => {
        if (direction === SwipeDirection.Right) {
          handleTokenCardClose();
          return true;
        }

        return false;
      },
    });
  }, [currentTokenSlug, handleTokenCardClose, isPortrait]);

  const appTheme = useAppTheme(theme);
  useAccentColor(isPortrait ? portraitContainerRef : landscapeContainerRef, appTheme, accentColorIndex);

  const handleEarnClick = useLastCallback((stakingId?: string) => {
    if (stakingId) changeCurrentStaking({ stakingId });

    if (isPortrait || isViewMode) {
      openStakingInfoOrStart();
    } else {
      setLandscapeActionsActiveTabIndex({ index: ActiveTab.Stake });
    }
  });

  function renderPortraitLayout() {
    return (
      <div ref={portraitContainerRef} className={styles.portraitContainer}>
        <div className={styles.head}>
          <Warnings onOpenBackupWallet={openBackupWalletModal} />
          <Card
            ref={cardRef}
            forceCloseAccountSelector={shouldRenderStickyCard}
            onTokenCardClose={handleTokenCardClose}
            onYieldClick={handleEarnClick}
          />
          {shouldRenderStickyCard && (
            <StickyCard
              ref={stickyCardRef}
            />
          )}
          {!isViewMode && (
            <PortraitActions
              containerRef={portraitContainerRef}
              isTestnet={isTestnet}
              stakingStatus={stakingStatus}
              isStakingDisabled={isStakingDisabled}
              isSwapDisabled={isSwapDisabled}
              isOnRampDisabled={isOnRampDisabled}
              onEarnClick={handleEarnClick}
            />
          )}
        </div>

        <Content onStakedTokenClick={handleEarnClick} />
      </div>
    );
  }

  function renderLandscapeLayout() {
    return (
      <div ref={landscapeContainerRef} className={styles.landscapeContainer}>
        <div className={buildClassName(styles.sidebar, 'custom-scroll')}>
          <Warnings onOpenBackupWallet={openBackupWalletModal} />
          <Card onTokenCardClose={handleTokenCardClose} onYieldClick={handleEarnClick} />
          {!isViewMode && (
            <LandscapeActions
              containerRef={landscapeContainerRef}
              stakingStatus={stakingStatus}
              isLedger={isLedger}
              theme={theme}
            />
          )}
        </div>
        <div className={styles.main}>
          <Content onStakedTokenClick={handleEarnClick} />
        </div>
      </div>
    );
  }

  return (
    <>
      {!IS_DELEGATED_BOTTOM_SHEET && (isPortrait ? renderPortraitLayout() : renderLandscapeLayout())}

      <StakeModal />
      <StakingInfoModal isOpen={isStakingInfoModalOpen} onClose={closeStakingInfo} />
      <ReceiveModal />
      <InvoiceModal />
      <UnstakeModal />
      <StakingClaimModal />
      <VestingModal />
      <VestingPasswordModal />
      <RenewDomainModal />
      <LinkingDomainModal />
      {!IS_ELECTRON && !IS_DELEGATED_BOTTOM_SHEET && <UpdateAvailable />}
    </>
  );
}

export default memo(
  withGlobal<OwnProps>(
    (global): StateProps => {
      const { ledger } = selectCurrentAccount(global) || {};
      const accountState = selectCurrentAccountState(global);
      const { currentTokenSlug } = accountState ?? {};

      const { isOnRampDisabled } = global.restrictions;

      const stakingState = global.currentAccountId
        ? selectAccountStakingState(global, global.currentAccountId)
        : undefined;

      return {
        stakingState,
        currentTokenSlug,
        isTestnet: global.settings.isTestnet,
        isLedger: Boolean(ledger),
        isViewMode: selectIsCurrentAccountViewMode(global),
        isStakingInfoModalOpen: global.isStakingInfoModalOpen,
        isMediaViewerOpen: Boolean(global.mediaViewer?.mediaId),
        isSwapDisabled: selectIsSwapDisabled(global),
        isStakingDisabled: selectIsStakingDisabled(global),
        isOnRampDisabled,
        theme: global.settings.theme,
        accentColorIndex: selectCurrentAccountSettings(global)?.accentColorIndex,
      };
    },
    (global, _, stickToFirst) => stickToFirst(global.currentAccountId),
  )(Main),
);

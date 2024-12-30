import React, {
  memo, useEffect, useMemo, useRef,
} from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiNft } from '../../../../api/types';
import type { StakingStateStatus } from '../../../../global/helpers/staking';
import type { Theme } from '../../../../global/types';
import { ActiveTab } from '../../../../global/types';

import { ANIMATED_STICKER_ICON_PX, DEFAULT_LANDSCAPE_ACTION_TAB_ID, TONCOIN } from '../../../../config';
import { requestMutation } from '../../../../lib/fasterdom/fasterdom';
import { selectAccountState, selectCurrentAccountSettings } from '../../../../global/selectors';
import { ACCENT_COLORS } from '../../../../util/accentColor';
import buildClassName from '../../../../util/buildClassName';
import { getChainBySlug } from '../../../../util/tokens';
import { IS_TOUCH_ENV } from '../../../../util/windowEnvironment';
import { ANIMATED_STICKERS_PATHS } from '../../../ui/helpers/animatedAssets';

import useAppTheme from '../../../../hooks/useAppTheme';
import useFlag from '../../../../hooks/useFlag';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useSyncEffect from '../../../../hooks/useSyncEffect';

import Content from '../../../receive/Content';
import StakingInfoContent from '../../../staking/StakingInfoContent';
import StakingInitial from '../../../staking/StakingInitial';
import SwapInitial from '../../../swap/SwapInitial';
import TransferInitial from '../../../transfer/TransferInitial';
import AnimatedIconWithPreview from '../../../ui/AnimatedIconWithPreview';
import Transition, { ACTIVE_SLIDE_CLASS_NAME, TO_SLIDE_CLASS_NAME } from '../../../ui/Transition';

import styles from './LandscapeActions.module.scss';

interface OwnProps {
  stakingStatus: StakingStateStatus;
  isLedger?: boolean;
  theme: Theme;
}

interface StateProps {
  activeTabIndex?: ActiveTab;
  nfts?: ApiNft[];
  tokenSlug: string;
  isTransferWithComment: boolean;
  isTestnet?: boolean;
  isSwapDisabled: boolean;
  isOnRampDisabled: boolean;
  accentColorIndex?: number;
}

const TABS = [ActiveTab.Receive, ActiveTab.Transfer, ActiveTab.Swap, ActiveTab.Stake];
const ANIMATED_STICKER_SPEED = 2;
let activeTransferKey = 0;

function LandscapeActions({
  stakingStatus,
  isLedger,
  theme,
  activeTabIndex = DEFAULT_LANDSCAPE_ACTION_TAB_ID,
  nfts,
  tokenSlug,
  isTransferWithComment,
  isTestnet,
  isSwapDisabled,
  isOnRampDisabled,
  accentColorIndex,
}: OwnProps & StateProps) {
  const { setLandscapeActionsActiveTabIndex: setActiveTabIndex } = getActions();

  const lang = useLang();

  const isStaking = activeTabIndex === ActiveTab.Stake && stakingStatus !== 'inactive';

  const {
    renderedBgHelpers,
    transitionRef,
  } = useTabHeightAnimation(
    styles.slideContent,
    styles.transferSlideContent,
    isStaking ? styles.contentSlideStaked : undefined,
    isStaking,
  );

  const isSwapAllowed = !isTestnet && !isLedger && !isSwapDisabled;
  const isOnRampAllowed = !isTestnet && !isOnRampDisabled;
  const isStakingAllowed = !isTestnet;
  const areNotAllTabs = !isSwapAllowed || !isStakingAllowed;
  const isLastTab = (!isStakingAllowed && !isSwapAllowed && activeTabIndex === ActiveTab.Transfer)
    || (!isStakingAllowed && isSwapAllowed && activeTabIndex === ActiveTab.Swap)
    || (isStakingAllowed && activeTabIndex === ActiveTab.Stake);
  const transferKey = useMemo(() => nfts?.map((nft) => nft.address).join(',') || tokenSlug, [nfts, tokenSlug]);

  const [isAddBuyAnimating, playAddBuyAnimation, stopAddBuyAnimation] = useFlag();
  const [isSendAnimating, playSendAnimation, stopSendAnimation] = useFlag();
  const [isSwapAnimating, playSwapAnimation, stopSwapAnimation] = useFlag();
  const [isStakeAnimating, playStakeAnimation, stopStakeAnimation] = useFlag();
  const appTheme = useAppTheme(theme);
  const stickerPaths = ANIMATED_STICKERS_PATHS[appTheme];
  const accentColor = accentColorIndex ? ACCENT_COLORS[appTheme][accentColorIndex] : undefined;

  const buttonTransitionKeyRef = useRef(0);
  useSyncEffect(() => {
    buttonTransitionKeyRef.current++;
  }, [accentColor]);

  useSyncEffect(() => {
    activeTransferKey += 1;
  }, [transferKey]);

  useEffect(() => {
    if (
      (!isSwapAllowed && activeTabIndex === ActiveTab.Swap)
      || (!isStakingAllowed && activeTabIndex === ActiveTab.Stake)
    ) {
      setActiveTabIndex({ index: ActiveTab.Transfer });
    }
  }, [activeTabIndex, isTestnet, isLedger, isSwapAllowed, isStakingAllowed]);

  function renderCurrentTab(isActive: boolean, isPrev: boolean) {
    switch (activeTabIndex) {
      case ActiveTab.Receive:
        return (
          <div className={buildClassName(styles.slideContent, styles.slideContentAddBuy)}>
            <Content isOpen={isActive} isStatic />
          </div>
        );

      case ActiveTab.Transfer:
        return (
          <div className={buildClassName(styles.slideContent, styles.slideContentTransfer)}>
            <Transition
              activeKey={activeTransferKey}
              name={isPrev ? 'semiFade' : 'none'}
              direction={!isTransferWithComment ? 'inverse' : undefined}
              shouldCleanup
              slideClassName={styles.transferSlideContent}
            >
              <TransferInitial key={activeTransferKey} isStatic />
            </Transition>
          </div>
        );

      case ActiveTab.Swap:
        return (
          <div className={styles.slideContent}>
            <SwapInitial isStatic isActive={isActive} />
          </div>
        );

      case ActiveTab.Stake:
        return (
          <div className={styles.slideContent}>
            {
              stakingStatus === 'inactive'
                ? <StakingInitial isStatic isActive={isActive} />
                : <StakingInfoContent isStatic isActive={isActive} />
            }
          </div>
        );

      default:
        return undefined;
    }
  }

  function handleSelectTab(index: ActiveTab, onTouchStart: NoneToVoidFunction) {
    if (IS_TOUCH_ENV) onTouchStart();

    setActiveTabIndex({ index }, { forceOnHeavyAnimation: true });
  }

  return (
    <div className={styles.container}>
      <div className={buildClassName(styles.tabs, areNotAllTabs && styles.notAllTabs)}>
        <div
          className={buildClassName(styles.tab, activeTabIndex === ActiveTab.Receive && styles.active)}
          onMouseEnter={!IS_TOUCH_ENV ? playAddBuyAnimation : undefined}
          onClick={() => {
            handleSelectTab(ActiveTab.Receive, playAddBuyAnimation);
          }}
        >
          <AnimatedIconWithPreview
            play={isAddBuyAnimating}
            size={ANIMATED_STICKER_ICON_PX}
            speed={ANIMATED_STICKER_SPEED}
            className={styles.tabIcon}
            key={accentColor}
            color={accentColor}
            nonInteractive
            forceOnHeavyAnimation
            tgsUrl={stickerPaths.iconAdd}
            iconPreviewClass="icon-action-add"
            onEnded={stopAddBuyAnimation}
          />
          <span className={styles.tabText}>{lang(isSwapAllowed || isOnRampAllowed ? 'Add / Buy' : 'Add')}</span>

          <span className={styles.tabDecoration} aria-hidden />
        </div>
        <div
          className={buildClassName(styles.tab, activeTabIndex === ActiveTab.Transfer && styles.active)}
          onMouseEnter={!IS_TOUCH_ENV ? playSendAnimation : undefined}
          onClick={() => {
            handleSelectTab(ActiveTab.Transfer, playSendAnimation);
          }}
        >
          <AnimatedIconWithPreview
            play={isSendAnimating}
            size={ANIMATED_STICKER_ICON_PX}
            speed={ANIMATED_STICKER_SPEED}
            className={styles.tabIcon}
            key={accentColor}
            color={accentColor}
            nonInteractive
            forceOnHeavyAnimation
            tgsUrl={stickerPaths.iconSend}
            iconPreviewClass="icon-action-send"
            onEnded={stopSendAnimation}
          />
          <span className={styles.tabText}>{lang('Send')}</span>
          <span className={styles.tabDecoration} aria-hidden />
          <span className={styles.tabDelimiter} aria-hidden />
        </div>
        {isSwapAllowed && (
          <div
            className={buildClassName(styles.tab, activeTabIndex === ActiveTab.Swap && styles.active)}
            onMouseEnter={!IS_TOUCH_ENV ? playSwapAnimation : undefined}
            onClick={() => {
              handleSelectTab(ActiveTab.Swap, playSwapAnimation);
            }}
          >
            <AnimatedIconWithPreview
              play={isSwapAnimating}
              size={ANIMATED_STICKER_ICON_PX}
              speed={ANIMATED_STICKER_SPEED}
              className={styles.tabIcon}
              key={accentColor}
              color={accentColor}
              nonInteractive
              forceOnHeavyAnimation
              tgsUrl={stickerPaths.iconSwap}
              iconPreviewClass="icon-action-swap"
              onEnded={stopSwapAnimation}
            />
            <span className={styles.tabText}>{lang('Swap')}</span>
            <span className={styles.tabDecoration} aria-hidden />
            <span className={styles.tabDelimiter} aria-hidden />
          </div>
        )}
        {isStakingAllowed && (
          <div
            className={buildClassName(
              styles.tab,
              activeTabIndex === ActiveTab.Stake && styles.active,
              isStaking && styles.tab_purple,
              stakingStatus !== 'inactive' && styles.tab_purpleText,
            )}
            onMouseEnter={!IS_TOUCH_ENV ? playStakeAnimation : undefined}
            onClick={() => {
              handleSelectTab(ActiveTab.Stake, playStakeAnimation);
            }}
          >
            <AnimatedIconWithPreview
              play={isStakeAnimating}
              size={ANIMATED_STICKER_ICON_PX}
              speed={ANIMATED_STICKER_SPEED}
              className={styles.tabIcon}
              key={accentColor}
              color={accentColor}
              nonInteractive
              forceOnHeavyAnimation
              tgsUrl={stickerPaths[stakingStatus !== 'inactive' ? 'iconEarnPurple' : 'iconEarn']}
              iconPreviewClass={buildClassName(
                'icon-action-earn',
                stakingStatus !== 'inactive' && styles.tab_purpleText,
              )}
              onEnded={stopStakeAnimation}
            />
            <span className={styles.tabText}>
              {lang({ inactive: 'Earn', active: 'Earning', unstakeRequested: 'Unstaking' }[stakingStatus])}
            </span>
            <span className={styles.tabDecoration} aria-hidden />
            <span className={styles.tabDelimiter} aria-hidden />
          </div>
        )}
      </div>

      <div
        className={buildClassName(
          styles.contentHeader,
          activeTabIndex === ActiveTab.Receive && styles.firstActive,
          isLastTab && styles.lastActive,
        )}
      >
        <div className={buildClassName(styles.contentHeaderInner, isStaking && styles.contentSlideStaked)} />
      </div>
      {renderedBgHelpers}

      <Transition
        ref={transitionRef}
        name="slideFade"
        activeKey={activeTabIndex}
        renderCount={TABS.length}
        className={buildClassName(styles.transitionContent, 'static-container')}
      >
        {renderCurrentTab}
      </Transition>
    </div>
  );
}

function useTabHeightAnimation(
  slideClassName: string,
  transferSlideClassName: string,
  contentBackgroundClassName?: string,
  isUnstaking = false,
) {
  // eslint-disable-next-line no-null/no-null
  const transitionRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const contentBgRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const contentFooterRef = useRef<HTMLDivElement>(null);

  const lastHeightRef = useRef<number>();

  const adjustBg = useLastCallback((noTransition = false) => {
    const activeSlideSelector = `.${slideClassName}.${ACTIVE_SLIDE_CLASS_NAME}`;
    const toSlideSelector = `.${slideClassName}.${TO_SLIDE_CLASS_NAME}`;
    const suffix = isUnstaking ? ' .staking-info' : '';
    // eslint-disable-next-line max-len
    const transferQuery = `${activeSlideSelector} .${transferSlideClassName}.${TO_SLIDE_CLASS_NAME}, ${activeSlideSelector} .${transferSlideClassName}.${ACTIVE_SLIDE_CLASS_NAME}`;
    const query = `${toSlideSelector}${suffix}, ${activeSlideSelector}${suffix}`;
    const slide = transitionRef.current?.querySelector(transferQuery) || transitionRef.current?.querySelector(query)!;
    const rect = slide.getBoundingClientRect();
    const shouldRenderWithoutTransition = !lastHeightRef.current || noTransition;

    if (lastHeightRef.current === rect.height || !contentBgRef.current) return;

    requestMutation(() => {
      if (!contentBgRef.current || !contentFooterRef.current) return;

      const contentBgStyle = contentBgRef.current.style;
      const contentFooterStyle = contentFooterRef.current!.style;

      if (shouldRenderWithoutTransition) {
        contentBgStyle.transition = 'none';
        contentFooterStyle.transition = 'none';
      }

      contentBgStyle.transform = `scaleY(calc(${rect.height} / 100))`;
      contentFooterStyle.transform = `translateY(${Math.floor(rect.height)}px)`;

      if (shouldRenderWithoutTransition) {
        requestMutation(() => {
          if (!contentBgRef.current || !contentFooterRef.current) return;

          contentBgRef.current.style.transition = '';
          contentFooterRef.current.style.transition = '';
        });
      }

      lastHeightRef.current = rect.height;
    });
  });

  useEffect(() => {
    adjustBg(true);

    const componentObserver = new ResizeObserver((entries) => {
      if (!entries.length) return;
      adjustBg();
    });

    if (transitionRef.current) {
      componentObserver.observe(transitionRef.current);
    }

    return () => {
      componentObserver.disconnect();
    };
  }, [adjustBg]);

  const renderedBgHelpers = useMemo(() => {
    return (
      <>
        <div ref={contentBgRef} className={buildClassName(styles.contentBg, contentBackgroundClassName)} />
        <div ref={contentFooterRef} className={buildClassName(styles.contentFooter, contentBackgroundClassName)} />
      </>
    );
  }, [contentBackgroundClassName]);

  return {
    renderedBgHelpers,
    transitionRef,
  };
}

export default memo(
  withGlobal<OwnProps>(
    (global): StateProps => {
      const accountState = selectAccountState(global, global.currentAccountId!) ?? {};

      const { isSwapDisabled, isOnRampDisabled } = global.restrictions;
      const { nfts, tokenSlug } = global.currentTransfer;
      const isTransferWithComment = getChainBySlug(tokenSlug) === TONCOIN.chain;

      return {
        activeTabIndex: accountState?.landscapeActionsActiveTabIndex,
        isTestnet: global.settings.isTestnet,
        nfts,
        tokenSlug,
        isTransferWithComment,
        isSwapDisabled,
        isOnRampDisabled,
        accentColorIndex: selectCurrentAccountSettings(global)?.accentColorIndex,
      };
    },
    (global, _, stickToFirst) => stickToFirst(global.currentAccountId),
  )(LandscapeActions),
);

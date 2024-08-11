import React, {
  memo, useEffect, useMemo, useRef,
} from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiNft } from '../../../../api/types';
import { ActiveTab } from '../../../../global/types';

import { DEFAULT_LANDSCAPE_ACTION_TAB_ID, TONCOIN_SLUG } from '../../../../config';
import { requestMutation } from '../../../../lib/fasterdom/fasterdom';
import { selectAccountState } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useSyncEffect from '../../../../hooks/useSyncEffect';

import AddBuyStatic from '../../../addbuy/AddBuyStatic';
import StakingInfoContent from '../../../staking/StakingInfoContent';
import StakingInitial from '../../../staking/StakingInitial';
import SwapInitial from '../../../swap/SwapInitial';
import TransferInitial from '../../../transfer/TransferInitial';
import Transition, { ACTIVE_SLIDE_CLASS_NAME, TO_SLIDE_CLASS_NAME } from '../../../ui/Transition';

import styles from './LandscapeActions.module.scss';

interface OwnProps {
  hasStaking?: boolean;
  isUnstakeRequested?: boolean;
  isLedger?: boolean;
}

interface StateProps {
  activeTabIndex?: ActiveTab;
  nfts?: ApiNft[];
  tokenSlug: string;
  isTestnet?: boolean;
  isSwapDisabled: boolean;
  isOnRampDisabled: boolean;
}

const TABS = [ActiveTab.Receive, ActiveTab.Transfer, ActiveTab.Swap, ActiveTab.Stake];
let activeTransferKey = 0;

function LandscapeActions({
  hasStaking,
  activeTabIndex = DEFAULT_LANDSCAPE_ACTION_TAB_ID,
  isUnstakeRequested,
  nfts,
  tokenSlug,
  isTestnet,
  isLedger,
  isSwapDisabled,
  isOnRampDisabled,
}: OwnProps & StateProps) {
  const { setLandscapeActionsActiveTabIndex: setActiveTabIndex } = getActions();

  const lang = useLang();

  const isStaking = activeTabIndex === ActiveTab.Stake && (hasStaking || isUnstakeRequested);
  const {
    renderedBgHelpers,
    transitionRef,
    handleTransitionStart,
  } = useTabHeightAnimation(
    styles.slideContent,
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
          <AddBuyStatic
            className={styles.slideContent}
            isStatic
            isTestnet={isTestnet}
            isLedger={isLedger}
            isSwapDisabled={isSwapDisabled}
            isOnRampDisabled={isOnRampDisabled}
          />
        );

      case ActiveTab.Transfer:
        return (
          <div className={buildClassName(styles.slideContent, styles.slideContentTransfer)}>
            <Transition
              activeKey={activeTransferKey}
              name={isPrev ? 'semiFade' : 'none'}
              shouldCleanup
              slideClassName={styles.slideContentInner}
            >
              <TransferInitial key={activeTransferKey} isStatic onCommentChange={handleTransitionStart} />
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
        if (hasStaking || isUnstakeRequested) {
          return (
            <div className={styles.slideContent}>
              <StakingInfoContent isStatic isActive={isActive} />
            </div>
          );
        }

        return (
          <div className={styles.slideContent}>
            <StakingInitial isStatic isActive={isActive} />
          </div>
        );

      default:
        return undefined;
    }
  }

  useEffect(() => {
    handleTransitionStart();
  }, [activeTabIndex, handleTransitionStart, lang]);

  function handleSelectTab(index: ActiveTab) {
    setActiveTabIndex({ index }, { forceOnHeavyAnimation: true });
  }

  return (
    <div className={styles.container}>
      <div className={
        buildClassName(styles.tabs, areNotAllTabs && styles.notAllTabs)
      }
      >
        <div
          className={buildClassName(styles.tab, activeTabIndex === ActiveTab.Receive && styles.active)}
          onClick={() => handleSelectTab(ActiveTab.Receive)}
        >
          <i className={buildClassName(styles.tabIcon, 'icon-add-buy')} aria-hidden />
          <span className={styles.tabText}>{lang(isSwapAllowed || isOnRampAllowed ? 'Add / Buy' : 'Add')}</span>

          <span className={styles.tabDecoration} aria-hidden />
        </div>
        <div
          className={buildClassName(styles.tab, activeTabIndex === ActiveTab.Transfer && styles.active)}
          onClick={() => handleSelectTab(ActiveTab.Transfer)}
        >
          <i className={buildClassName(styles.tabIcon, 'icon-send')} aria-hidden />
          <span className={styles.tabText}>{lang('Send')}</span>
          <span className={styles.tabDecoration} aria-hidden />
          <span className={styles.tabDelimiter} aria-hidden />
        </div>
        {isSwapAllowed && (
          <div
            className={buildClassName(styles.tab, activeTabIndex === ActiveTab.Swap && styles.active)}
            onClick={() => handleSelectTab(ActiveTab.Swap)}
          >
            <i className={buildClassName(styles.tabIcon, 'icon-swap')} aria-hidden />
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
              (hasStaking || isUnstakeRequested) && styles.tab_purpleText,
            )}
            onClick={() => handleSelectTab(ActiveTab.Stake)}
          >
            <i className={buildClassName(styles.tabIcon, 'icon-earn')} aria-hidden />
            <span className={styles.tabText}>
              {lang(isUnstakeRequested ? 'Unstaking' : (hasStaking ? 'Earning' : 'Earn'))}
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
        className={styles.transitionContent}
      >
        {renderCurrentTab}
      </Transition>
    </div>
  );
}

function useTabHeightAnimation(slideClassName: string, contentBackgroundClassName?: string, isUnstaking = false) {
  // eslint-disable-next-line no-null/no-null
  const transitionRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const contentBgRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const contentFooterRef = useRef<HTMLDivElement>(null);

  const lastHeightRef = useRef<number>();

  const suffix = isUnstaking ? ' .staking-info' : '';
  // eslint-disable-next-line max-len
  const query = `.${slideClassName}.${TO_SLIDE_CLASS_NAME}${suffix}, .${slideClassName}.${TO_SLIDE_CLASS_NAME}${suffix}, .${slideClassName}.${ACTIVE_SLIDE_CLASS_NAME}${suffix}, .${slideClassName}.${ACTIVE_SLIDE_CLASS_NAME}${suffix}`;

  const adjustBg = useLastCallback((noTransition = false) => {
    const slide = transitionRef.current?.querySelector(query)!;
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
      adjustBg(false);
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
    handleTransitionStart: adjustBg,
  };
}

export default memo(
  withGlobal<OwnProps>(
    (global): StateProps => {
      const accountState = selectAccountState(global, global.currentAccountId!) ?? {};

      const { isSwapDisabled, isOnRampDisabled } = global.restrictions;
      const { nfts, tokenSlug = TONCOIN_SLUG } = global.currentTransfer;

      return {
        activeTabIndex: accountState?.landscapeActionsActiveTabIndex,
        isTestnet: global.settings.isTestnet,
        nfts,
        tokenSlug,
        isSwapDisabled,
        isOnRampDisabled,
      };
    },
    (global, _, stickToFirst) => stickToFirst(global.currentAccountId),
  )(LandscapeActions),
);

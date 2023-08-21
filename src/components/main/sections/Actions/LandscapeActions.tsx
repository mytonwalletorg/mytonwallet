import React, {
  memo, useEffect, useMemo, useRef,
} from '../../../../lib/teact/teact';

import { ElectronEvent } from '../../../../electron/types';
import { ActiveTab } from '../../../../global/types';

import { DEFAULT_LANDSCAPE_ACTION_TAB_ID } from '../../../../config';
import { getActions, withGlobal } from '../../../../global';
import { selectLandscapeActionsActiveTabIndex } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { fastRaf } from '../../../../util/schedulers';
import { ReceiveStatic } from '../../../receive';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import StakingInfoContent from '../../../staking/StakingInfoContent';
import StakingInitial from '../../../staking/StakingInitial';
import TransferInitial from '../../../transfer/TransferInitial';
import Transition, { ACTIVE_SLIDE_CLASS_NAME, TO_SLIDE_CLASS_NAME } from '../../../ui/Transition';

import styles from './LandscapeActions.module.scss';

const TABS = [ActiveTab.Receive, ActiveTab.Transfer, ActiveTab.Stake];

interface OwnProps {
  hasStaking?: boolean;
  isUnstakeRequested?: boolean;
  isLedger?: boolean;
}

interface StateProps {
  activeTabIndex: ActiveTab;
  isTestnet?: boolean;
}

function LandscapeActions({
  hasStaking,
  activeTabIndex,
  isUnstakeRequested,
  isTestnet,
  isLedger,
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

  useEffect(() => {
    if ((isTestnet || isLedger) && [ActiveTab.Stake].includes(activeTabIndex)) {
      setActiveTabIndex({ index: ActiveTab.Transfer });
    }
  }, [activeTabIndex, isTestnet, isLedger]);

  function renderCurrentTab(isActive: boolean) {
    switch (activeTabIndex) {
      case ActiveTab.Receive:
        return <ReceiveStatic className={styles.slideContent} />;

      case ActiveTab.Transfer:
        return (
          <div className={styles.slideContent}>
            <TransferInitial isStatic onCommentChange={handleTransitionStart} />
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
    return window.electron?.on(ElectronEvent.DEEPLINK, () => {
      setActiveTabIndex({ index: DEFAULT_LANDSCAPE_ACTION_TAB_ID });
    });
  }, [setActiveTabIndex]);

  useEffect(() => {
    handleTransitionStart();
  }, [activeTabIndex, handleTransitionStart, lang]);

  return (
    <div className={styles.container}>
      <div className={
        buildClassName(styles.tabs, (isTestnet || isLedger) && styles.notAllTabs)
      }
      >
        <div
          className={buildClassName(styles.tab, activeTabIndex === ActiveTab.Receive && styles.active)}
          onClick={() => setActiveTabIndex({ index: ActiveTab.Receive })}
        >
          <i className={buildClassName(styles.tabIcon, 'icon-receive')} aria-hidden />
          <span className={styles.tabText}>{lang('Receive')}</span>

          <span className={styles.tabDecoration} aria-hidden />
        </div>
        <div
          className={buildClassName(styles.tab, activeTabIndex === ActiveTab.Transfer && styles.active)}
          onClick={() => setActiveTabIndex({ index: ActiveTab.Transfer })}
        >
          <i className={buildClassName(styles.tabIcon, 'icon-send')} aria-hidden />
          <span className={styles.tabText}>{lang('Send')}</span>
          <span className={styles.tabDecoration} aria-hidden />
          <span className={styles.tabDelimiter} aria-hidden />
        </div>
        {!isTestnet && !isLedger && (
          <div
            className={buildClassName(
              styles.tab,
              activeTabIndex === ActiveTab.Stake && styles.active,
              isStaking && styles.tab_purple,
            )}
            onClick={() => setActiveTabIndex({ index: ActiveTab.Stake })}
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
          activeTabIndex === ActiveTab.Stake && styles.lastActive,
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

    const contentBgStyle = contentBgRef.current.style;
    const contentFooterStyle = contentFooterRef.current!.style;

    if (shouldRenderWithoutTransition) {
      contentBgStyle.transition = 'none';
      contentFooterStyle.transition = 'none';
    }

    contentBgStyle.transform = `scaleY(calc(${rect.height} / 100))`;
    contentFooterStyle.transform = `translateY(${Math.floor(rect.height)}px)`;

    if (shouldRenderWithoutTransition) {
      fastRaf(() => {
        if (!contentBgRef.current || !contentFooterRef.current) return;

        contentBgRef.current.style.transition = '';
        contentFooterRef.current.style.transition = '';
      });
    }

    lastHeightRef.current = rect.height;
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
  withGlobal<OwnProps>((global): StateProps => {
    const activeTabIndex = selectLandscapeActionsActiveTabIndex(global);

    return {
      activeTabIndex,
      isTestnet: global.settings.isTestnet,
    };
  })(LandscapeActions),
);

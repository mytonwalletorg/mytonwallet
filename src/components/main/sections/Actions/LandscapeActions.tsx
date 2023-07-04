import React, {
  memo, useCallback, useEffect, useMemo, useRef,
} from '../../../../lib/teact/teact';

import { ElectronEvent } from '../../../../electron/types';

import { getActions, withGlobal } from '../../../../global';
import { selectLandscapeActionsActiveTabIndex } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import getBoundingClientRectsAsync from '../../../../util/getBoundingClientReactAsync';
import { fastRaf } from '../../../../util/schedulers';
import { ReceiveStatic } from '../../../receive';

import useLang from '../../../../hooks/useLang';

import StakingInfoContent from '../../../staking/StakingInfoContent';
import StakingInitial from '../../../staking/StakingInitial';
import TransferInitial from '../../../transfer/TransferInitial';
import Transition, { ACTIVE_SLIDE_CLASS_NAME, TO_SLIDE_CLASS_NAME } from '../../../ui/Transition';

import styles from './LandscapeActions.module.scss';

const TABS = ['receive', 'send', 'earn'];

interface OwnProps {
  hasStaking?: boolean;
  isUnstakeRequested?: boolean;
}

interface StateProps {
  activeTabIndex: 0 | 1 | 2;
}

const STAKING_TAB_INDEX = 2;

function LandscapeActions({
  hasStaking,
  activeTabIndex,
  isUnstakeRequested,
}: OwnProps & StateProps) {
  const { setLandscapeActionsActiveTabIndex: setActiveTabIndex } = getActions();

  const lang = useLang();

  const isStaking = activeTabIndex === STAKING_TAB_INDEX && (hasStaking || isUnstakeRequested);
  const {
    renderedBgHelpers,
    transitionRef,
    handleTransitionStart,
  } = useTabHeightAnimation(
    styles.slideContent,
    isStaking ? styles.contentSlideStaked : undefined,
    isStaking,
  );

  function renderCurrentTab(isActive: boolean) {
    switch (TABS[activeTabIndex]) {
      case 'receive':
        return <ReceiveStatic className={styles.slideContent} />;

      case 'send':
        return (
          <div className={styles.slideContent}>
            <TransferInitial isStatic onCommentChange={handleTransitionStart} />
          </div>
        );

      case 'earn':
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
      setActiveTabIndex({ index: 1 });
    });
  }, [setActiveTabIndex]);

  useEffect(() => {
    handleTransitionStart();
  }, [activeTabIndex, handleTransitionStart]);

  return (
    <div className={styles.container}>
      <div className={styles.tabs}>
        <div
          className={buildClassName(styles.tab, activeTabIndex === 0 && styles.active)}
          onClick={() => setActiveTabIndex({ index: 0 })}
        >
          <i className={buildClassName(styles.tabIcon, 'icon-receive')} aria-hidden />
          <span>{lang('Receive')}</span>

          <span className={styles.tabDecoration} aria-hidden />
        </div>
        <div
          className={buildClassName(styles.tab, activeTabIndex === 1 && styles.active)}
          onClick={() => setActiveTabIndex({ index: 1 })}
        >
          <i className={buildClassName(styles.tabIcon, 'icon-send')} aria-hidden />
          <span>{lang('Send')}</span>
          <span className={styles.tabDecoration} aria-hidden />
          <span className={styles.tabDelimiter} aria-hidden />
        </div>
        <div
          className={buildClassName(
            styles.tab,
            activeTabIndex === STAKING_TAB_INDEX && styles.active,
            isStaking && styles.tab_purple,
          )}
          onClick={() => setActiveTabIndex({ index: STAKING_TAB_INDEX })}
        >
          <i className={buildClassName(styles.tabIcon, 'icon-earn')} aria-hidden />
          <span>{lang(isUnstakeRequested ? 'Unstaking' : (hasStaking ? 'Earning' : 'Earn'))}</span>
          <span className={styles.tabDecoration} aria-hidden />
          <span className={styles.tabDelimiter} aria-hidden />
        </div>
      </div>

      <div
        className={buildClassName(
          styles.contentHeader,
          activeTabIndex === 0 && styles.firstActive,
          activeTabIndex === TABS.length - 1 && styles.lastActive,
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

  const adjustBg = useCallback((noTransition = false) => {
    const suffix = isUnstaking ? ' .staking-info' : '';
    const nextSlide = transitionRef.current!.querySelector<HTMLDivElement>(
      // eslint-disable-next-line max-len
      `.${slideClassName}.${TO_SLIDE_CLASS_NAME}${suffix}, .${slideClassName}.${TO_SLIDE_CLASS_NAME}${suffix}, .${slideClassName}.${ACTIVE_SLIDE_CLASS_NAME}${suffix}, .${slideClassName}.${ACTIVE_SLIDE_CLASS_NAME}${suffix}`,
    )!;

    getBoundingClientRectsAsync(nextSlide).then((rect) => {
      if (lastHeightRef.current !== rect.height && contentBgRef.current) {
        if (noTransition) {
          contentBgRef.current.style.transition = 'none';
          contentFooterRef.current!.style.transition = 'none';
        }

        contentBgRef.current.style.transform = `scaleY(calc(${rect.height} / 100))`;
        contentFooterRef.current!.style.transform = `translateY(${Math.floor(rect.height)}px)`;

        if (noTransition) {
          // For some reason, single `fastRaf` was not enough
          fastRaf(() => {
            fastRaf(() => {
              contentBgRef.current!.style.transition = '';
              contentFooterRef.current!.style.transition = '';
            });
          });
        }

        lastHeightRef.current = rect.height;
      }
    });
  }, [isUnstaking, slideClassName]);

  const lang = useLang();

  useEffect(() => {
    adjustBg(true);
  }, [adjustBg, lang]);

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

    return { activeTabIndex };
  })(LandscapeActions),
);

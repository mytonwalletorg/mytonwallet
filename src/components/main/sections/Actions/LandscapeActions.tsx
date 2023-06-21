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

import TransferInitial from '../../../transfer/TransferInitial';
import Button from '../../../ui/Button';
import Transition, { ACTIVE_SLIDE_CLASS_NAME, TO_SLIDE_CLASS_NAME } from '../../../ui/Transition';

import styles from './LandscapeActions.module.scss';

const TABS = [
  { id: 'receive', title: 'Receive', className: styles.tab },
  { id: 'send', title: 'Send', className: styles.tab },
];

interface OwnProps {
  hasStaking?: boolean;
  isUnstakeRequested?: boolean;
  onEarnClick: NoneToVoidFunction;
}

interface StateProps {
  activeTabIndex: 0 | 1;
}

function LandscapeActions({
  hasStaking,
  activeTabIndex,
  isUnstakeRequested,
  onEarnClick,
}: OwnProps & StateProps) {
  const { setLandscapeActionsActiveTabIndex: setActiveTabIndex } = getActions();

  const lang = useLang();
  const { renderedBgHelpers, transitionRef, handleTransitionStart } = useTabHeightAnimation();

  function renderCurrentTab() {
    switch (TABS[activeTabIndex].id) {
      case 'receive':
        return <ReceiveStatic className={styles.slideContent} />;

      case 'send':
        return (
          <div className={styles.slideContent}>
            <TransferInitial isStatic />
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
        <Button
          className={buildClassName(styles.tab, activeTabIndex === 0 && styles.active)}
          isSimple
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => setActiveTabIndex({ index: 0 })}
        >
          <i className={buildClassName(styles.tabIcon, 'icon-receive')} aria-hidden />
          <span>{lang('Receive')}</span>

          <span className={styles.tabDecoration} aria-hidden />
        </Button>
        <Button
          className={buildClassName(styles.tab, activeTabIndex === 1 && styles.active)}
          isSimple
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => setActiveTabIndex({ index: 1 })}
        >
          <i className={buildClassName(styles.tabIcon, 'icon-send')} aria-hidden />
          <span>{lang('Send')}</span>
          <span className={styles.tabDecoration} aria-hidden />
          <span className={styles.tabDelimiter} aria-hidden />
        </Button>
        <Button className={buildClassName(styles.tab, hasStaking && styles.tab_purple)} onClick={onEarnClick} isSimple>
          <i className={buildClassName(styles.tabIcon, 'icon-earn')} aria-hidden />
          <span>{lang(isUnstakeRequested ? 'Unstaking' : (hasStaking ? 'Earning' : 'Earn'))}</span>
          <span className={styles.tabDecoration} aria-hidden />
        </Button>
      </div>

      <div
        className={buildClassName(
          styles.contentHeader,
          activeTabIndex === 0 && styles.firstActive,
          activeTabIndex === TABS.length - 1 && styles.lastActive,
        )}
      >
        <div className={styles.contentHeaderInner} />
      </div>
      {renderedBgHelpers}

      <Transition
        ref={transitionRef}
        name="slideFade"
        activeKey={activeTabIndex}
        renderCount={TABS.length}
        className={styles.slides}
        slideClassName={buildClassName(styles.slide, 'custom-scroll')}
      >
        {renderCurrentTab}
      </Transition>
    </div>
  );
}

function useTabHeightAnimation() {
  // eslint-disable-next-line no-null/no-null
  const transitionRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const contentBgRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const contentFooterRef = useRef<HTMLDivElement>(null);

  const lastHeightRef = useRef<number>();

  const adjustBg = useCallback((noTransition = false) => {
    const nextSlide = transitionRef.current!.querySelector<HTMLDivElement>(
      `.${ACTIVE_SLIDE_CLASS_NAME}, .${TO_SLIDE_CLASS_NAME}`,
    )!;

    getBoundingClientRectsAsync(nextSlide).then((rect) => {
      if (lastHeightRef.current !== rect.height && contentBgRef.current) {
        if (noTransition) {
          contentBgRef.current.style.transition = 'none';
          contentFooterRef.current!.style.transition = 'none';
        }

        contentBgRef.current.style.transform = `scaleY(calc(${rect.height} / 100))`;
        contentFooterRef.current!.style.transform = `translateY(${rect.height}px)`;

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
  }, []);

  const lang = useLang();

  useEffect(() => {
    adjustBg(true);
  }, [adjustBg, lang]);

  const renderedBgHelpers = useMemo(() => {
    return (
      <>
        <div ref={contentBgRef} className={styles.contentBg} />
        <div ref={contentFooterRef} className={styles.contentFooter} />
      </>
    );
  }, []);

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

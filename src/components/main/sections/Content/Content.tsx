import React, {
  memo, useEffect, useMemo, useRef,
} from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import { ContentTab } from '../../../../global/types';

import { JUSDT_TOKEN_SLUG, MIN_ASSETS_TAB_VIEW, TON_TOKEN_SLUG } from '../../../../config';
import {
  selectAccountState,
  selectCurrentAccountTokens,
  selectEnabledTokensCountMemoized,
  selectIsHardwareAccount,
} from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { captureEvents, SwipeDirection } from '../../../../util/captureEvents';
import { IS_TOUCH_ENV } from '../../../../util/windowEnvironment';

import { useDeviceScreen } from '../../../../hooks/useDeviceScreen';
import useEffectOnce from '../../../../hooks/useEffectOnce';
import useHistoryBack from '../../../../hooks/useHistoryBack';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import TabList from '../../../ui/TabList';
import Transition from '../../../ui/Transition';
import Activity from './Activities';
import Assets from './Assets';
import Nfts from './Nfts';

import styles from './Content.module.scss';

interface OwnProps {
  onStakedTokenClick: NoneToVoidFunction;
}

interface StateProps {
  isNftSupported: boolean;
  tokensCount: number;
  activeContentTab?: ContentTab;
}

function Content({
  activeContentTab,
  tokensCount,
  onStakedTokenClick,
  isNftSupported,
}: OwnProps & StateProps) {
  const {
    selectToken,
    setActiveContentTab,
    setDefaultSwapParams,
    changeTransferToken,
  } = getActions();
  const { isLandscape } = useDeviceScreen();

  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const transitionRef = useRef<HTMLDivElement>(null);

  const shouldShowSeparateAssetsPanel = tokensCount > 0 && tokensCount < MIN_ASSETS_TAB_VIEW;
  const TABS = useMemo(
    () => [
      ...(!shouldShowSeparateAssetsPanel
        ? [{ id: ContentTab.Assets, title: lang('Assets') as string, className: styles.tab }]
        : []),
      { id: ContentTab.Activity, title: lang('Activity') as string, className: styles.tab },
      ...(isNftSupported
        ? [{ id: ContentTab.Nft, title: lang('NFT') as string, className: styles.tab }]
        : []),
    ],
    [lang, shouldShowSeparateAssetsPanel, isNftSupported],
  );

  const activeTabIndex = useMemo(
    () => {
      const tabIndex = TABS.findIndex((tab) => tab.id === activeContentTab);

      if (tabIndex === -1) {
        return ContentTab.Assets;
      }

      return tabIndex;
    },
    [TABS, activeContentTab],
  );

  useEffectOnce(() => {
    if (activeContentTab === undefined) {
      setActiveContentTab({ tab: ContentTab.Assets });
    }
  });

  const handleSwitchTab = useLastCallback((tab: ContentTab) => {
    selectToken({ slug: undefined }, { forceOnHeavyAnimation: true });
    setActiveContentTab({ tab }, { forceOnHeavyAnimation: true });
  });

  useHistoryBack({
    isActive: activeTabIndex !== 0,
    onBack: () => handleSwitchTab(ContentTab.Assets),
  });

  useEffect(() => {
    if (!IS_TOUCH_ENV) {
      return undefined;
    }

    return captureEvents(transitionRef.current!, {
      includedClosestSelector: '.swipe-container',
      onSwipe: (e, direction) => {
        if (direction === SwipeDirection.Left) {
          const tab = TABS[Math.min(TABS.length - 1, activeTabIndex + 1)];
          handleSwitchTab(tab.id);
          return true;
        } else if (direction === SwipeDirection.Right) {
          const tab = TABS[Math.max(0, activeTabIndex - 1)];
          handleSwitchTab(tab.id);
          return true;
        }

        return false;
      },
    });
  }, [TABS, handleSwitchTab, activeTabIndex]);

  const handleClickAsset = useLastCallback((slug: string) => {
    selectToken({ slug });

    if (slug) {
      if (slug === TON_TOKEN_SLUG) {
        setDefaultSwapParams({ tokenInSlug: JUSDT_TOKEN_SLUG, tokenOutSlug: slug });
      } else {
        setDefaultSwapParams({ tokenOutSlug: slug });
      }
      changeTransferToken({ tokenSlug: slug });
    }

    setActiveContentTab({ tab: ContentTab.Activity });
  });

  const containerClassName = buildClassName(
    styles.container,
    IS_TOUCH_ENV && 'swipe-container',
    isLandscape ? styles.landscapeContainer : styles.portraitContainer,
  );

  function renderCurrentTab(isActive: boolean) {
    // When assets are shown separately, there is effectively no tab with index 0,
    // so we fall back to next tab to not break parent's component logic.
    if (activeTabIndex === 0 && shouldShowSeparateAssetsPanel) {
      return <Activity isActive={isActive} mobileRef={containerRef} />;
    }

    switch (TABS[activeTabIndex].id) {
      case ContentTab.Assets:
        return <Assets isActive={isActive} onTokenClick={handleClickAsset} onStakedTokenClick={onStakedTokenClick} />;
      case ContentTab.Activity:
        return <Activity isActive={isActive} mobileRef={containerRef} />;
      case ContentTab.Nft:
        return <Nfts isActive={isActive} />;
      default:
        return undefined;
    }
  }

  function renderContent() {
    return (
      <>
        <TabList
          tabs={TABS}
          activeTab={activeTabIndex}
          onSwitchTab={handleSwitchTab}
          className={buildClassName(styles.tabs, 'content-tabslist')}
        />
        <Transition
          ref={transitionRef}
          name={isLandscape ? 'slideFade' : 'slide'}
          activeKey={activeTabIndex}
          renderCount={TABS.length}
          className={buildClassName(styles.slides, 'content-transition')}
          slideClassName={buildClassName(styles.slide, 'custom-scroll')}
        >
          {renderCurrentTab}
        </Transition>
      </>
    );
  }

  return (
    <div
      ref={containerRef}
      className={containerClassName}
    >
      {shouldShowSeparateAssetsPanel && (
        <div className={styles.assetsPanel}>
          <Assets
            isActive
            isSeparatePanel
            onStakedTokenClick={onStakedTokenClick}
            onTokenClick={handleClickAsset}
          />
        </div>
      )}
      {isLandscape ? renderContent() : (<div className={styles.contentPanel}>{renderContent()}</div>)}
    </div>
  );
}

export default memo(
  withGlobal<OwnProps>(
    (global): StateProps => {
      const accountState = selectAccountState(global, global.currentAccountId!) ?? {};
      const tokens = selectCurrentAccountTokens(global);
      const tokensCount = selectEnabledTokensCountMemoized(tokens);
      const isLedger = selectIsHardwareAccount(global);

      return {
        tokensCount,
        isNftSupported: !isLedger,
        activeContentTab: accountState?.activeContentTab,
      };
    },
    (global, _, stickToFirst) => stickToFirst(global.currentAccountId),
  )(Content),
);

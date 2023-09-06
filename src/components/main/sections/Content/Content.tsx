import React, {
  memo, useEffect, useMemo, useRef,
} from '../../../../lib/teact/teact';

import type { UserToken } from '../../../../global/types';

import { getActions, withGlobal } from '../../../../global';
import { selectCurrentAccountTokens, selectIsHardwareAccount } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';

import { useDeviceScreen } from '../../../../hooks/useDeviceScreen';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import TabList from '../../../ui/TabList';
import Transition from '../../../ui/Transition';
import Activity from './Activity';
import Assets from './Assets';
import Nfts from './Nfts';

import styles from './Content.module.scss';

interface OwnProps {
  activeTabIndex: number;
  setActiveTabIndex: (index: number) => void;
  onStakedTokenClick: NoneToVoidFunction;
}

interface StateProps {
  tokens?: UserToken[];
  isNftSupported: boolean;
}

enum TabId {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  Assets,
  // eslint-disable-next-line @typescript-eslint/no-shadow
  Activity,
  Nft,
}

const MIN_ASSETS_TAB_VIEW = 5;
const DEFAULT_TABS_COUNT = 3;
const STICKY_CARD_HEIGHT = 60;

function Content({
  activeTabIndex, tokens, setActiveTabIndex, onStakedTokenClick, isNftSupported,
}: OwnProps & StateProps) {
  const { selectToken } = getActions();
  const { isLandscape } = useDeviceScreen();

  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);

  const tokenCount = useMemo(() => (tokens ?? []).filter(({ isDisabled }) => !isDisabled).length, [tokens]);
  const shouldShowSeparateAssetsPanel = tokenCount > 0 && tokenCount < MIN_ASSETS_TAB_VIEW;
  const TABS = useMemo(
    () => [
      ...(!shouldShowSeparateAssetsPanel
        ? [{ id: TabId.Assets, title: lang('Assets') as string, className: styles.tab }]
        : []),
      { id: TabId.Activity, title: lang('Activity') as string, className: styles.tab },
      ...(isNftSupported ? [{ id: TabId.Nft, title: lang('NFT') as string, className: styles.tab }] : []),
    ],
    [lang, shouldShowSeparateAssetsPanel, isNftSupported],
  );

  // Calculate the difference between the default number of tabs and the current number of tabs.
  // This shift is used to adjust the tab index in landscape mode.
  const indexShift = DEFAULT_TABS_COUNT - TABS.length;
  const realActiveIndex = activeTabIndex === 0 ? activeTabIndex : activeTabIndex - indexShift;

  useEffect(() => {
    if (isLandscape || realActiveIndex !== TabId.Activity) {
      return;
    }

    const contentTop = containerRef.current?.getBoundingClientRect().top ?? 0;
    const containerEl = containerRef.current?.closest<HTMLDivElement>('.app-slide-content');

    if (contentTop > STICKY_CARD_HEIGHT || !containerEl) {
      return;
    }

    containerEl.scrollTop = containerEl.scrollTop + contentTop - STICKY_CARD_HEIGHT;
  }, [isLandscape, realActiveIndex]);

  const handleSwitchTab = useLastCallback((index: number) => {
    selectToken({ slug: undefined });
    setActiveTabIndex(index + indexShift);
  });

  const handleClickAssets = useLastCallback((slug: string) => {
    selectToken({ slug });
    setActiveTabIndex(TABS.findIndex((tab) => tab.id === TabId.Activity));
  });

  function renderCurrentTab(isActive: boolean) {
    // When assets are shown separately, there is effectively no tab with index 0,
    // so we fall back to next tab to not break parent's component logic.
    if (realActiveIndex === 0 && shouldShowSeparateAssetsPanel) {
      return <Activity isActive={isActive} />;
    }

    switch (TABS[realActiveIndex].id) {
      case TabId.Assets:
        return <Assets isActive={isActive} onTokenClick={handleClickAssets} onStakedTokenClick={onStakedTokenClick} />;
      case TabId.Activity:
        return <Activity isActive={isActive} />;
      case TabId.Nft:
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
          activeTab={realActiveIndex}
          onSwitchTab={handleSwitchTab}
          className={buildClassName(styles.tabs, 'content-tabslist')}
        />
        <Transition
          name={isLandscape ? 'slideFade' : 'slide'}
          activeKey={realActiveIndex}
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
      className={buildClassName(styles.container, isLandscape ? styles.landscapeContainer : styles.portraitContainer)}
    >
      {shouldShowSeparateAssetsPanel && (
        <div className={styles.assetsPanel}>
          <Assets
            isActive
            noGreeting
            onStakedTokenClick={onStakedTokenClick}
            onTokenClick={handleClickAssets}
          />
        </div>
      )}
      {isLandscape ? renderContent() : (<div className={styles.contentPanel}>{renderContent()}</div>)}
    </div>
  );
}

export default memo(
  withGlobal<OwnProps>((global, ownProps, detachWhenChanged): StateProps => {
    detachWhenChanged(global.currentAccountId);

    const tokens = selectCurrentAccountTokens(global);
    const isLedger = selectIsHardwareAccount(global);

    return {
      tokens,
      isNftSupported: !isLedger,
    };
  })(Content),
);

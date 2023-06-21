import React, { memo, useCallback, useMemo } from '../../../../lib/teact/teact';

import { getActions, withGlobal } from '../../../../global';
import { selectCurrentAccountTokens } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';

import { useDeviceScreen } from '../../../../hooks/useDeviceScreen';
import useLang from '../../../../hooks/useLang';

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
  tokenCount: number;
}

const MIN_ASSETS_FOR_DESKTOP_TAB_VIEW = 5;

function Content({
  activeTabIndex, tokenCount, setActiveTabIndex, onStakedTokenClick,
}: OwnProps & StateProps) {
  const { selectToken } = getActions();
  const { isLandscape } = useDeviceScreen();

  const lang = useLang();

  const shouldShowSeparateAssetsPanel = isLandscape && tokenCount < MIN_ASSETS_FOR_DESKTOP_TAB_VIEW;

  const TABS = useMemo(
    () => [
      ...(!shouldShowSeparateAssetsPanel
        ? [{ id: 'assets', title: lang('Assets') as string, className: styles.tab }]
        : []),
      { id: 'activity', title: lang('Activity') as string, className: styles.tab },
      { id: 'nft', title: lang('NFT') as string, className: styles.tab },
    ],
    [lang, shouldShowSeparateAssetsPanel],
  );

  const handleSwitchTab = useCallback(
    (index: number) => {
      selectToken({ slug: undefined });
      setActiveTabIndex(index);
    },
    [selectToken, setActiveTabIndex],
  );

  const handleClickAssets = useCallback(
    (slug: string) => {
      selectToken({ slug });
      setActiveTabIndex(TABS.findIndex((tab) => tab.id === 'activity'));
    },
    [TABS, selectToken, setActiveTabIndex],
  );

  function renderCurrentTab(isActive: boolean) {
    // When assets are shown separately, there is effectively no tab with index 0,
    // so we fall back to next tab to not break parent's component logic.
    if (activeTabIndex === 0 && shouldShowSeparateAssetsPanel) {
      return <Activity isActive={isActive} />;
    }

    switch (TABS[activeTabIndex].id) {
      case 'assets':
        return <Assets isActive={isActive} onTokenClick={handleClickAssets} onStakedTokenClick={onStakedTokenClick} />;

      case 'activity':
        return <Activity isActive={isActive} />;

      case 'nft':
        return <Nfts isActive={isActive} />;

      default:
        return undefined;
    }
  }

  return (
    <div
      className={buildClassName(styles.container, isLandscape ? styles.landscapeContainer : styles.portraitContainer)}
    >
      {shouldShowSeparateAssetsPanel && (
        <div className={styles.assetsPanel}>
          <Assets isActive onStakedTokenClick={onStakedTokenClick} onTokenClick={handleClickAssets} />
        </div>
      )}
      <TabList tabs={TABS} activeTab={activeTabIndex} onSwitchTab={handleSwitchTab} className={styles.tabs} />
      <Transition
        name={isLandscape ? 'slideFade' : 'slide'}
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

export default memo(
  withGlobal<OwnProps>((global, ownProps, detachWhenChanged): StateProps => {
    detachWhenChanged(global.currentAccountId);

    const tokens = selectCurrentAccountTokens(global);

    return {
      tokenCount: tokens?.length ?? 0,
    };
  })(Content),
);

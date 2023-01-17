import React, { memo, useCallback, useMemo } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import buildClassName from '../../../../util/buildClassName';
import useLang from '../../../../hooks/useLang';

import TabList from '../../../ui/TabList';
import Transition from '../../../ui/Transition';

import Assets from './Assets';
import Activity from './Activity';
import Nfts from './Nfts';

import styles from './Content.module.scss';

interface OwnProps {
  activeTabIndex: number;
  setActiveTabIndex: (index: number) => void;
  onStakedTokenClick: NoneToVoidFunction;
}

function Content({ activeTabIndex, onStakedTokenClick, setActiveTabIndex }: OwnProps) {
  const { selectToken } = getActions();

  const lang = useLang();

  const TABS = useMemo(() => ([
    { id: 'assets', title: lang('Assets') as string, className: styles.tab },
    { id: 'activity', title: lang('Activity') as string, className: styles.tab },
    { id: 'nft', title: lang('NFT') as string, className: styles.tab },
  ]), [lang]);

  const handleSwitchTab = useCallback((index: number) => {
    selectToken({ slug: undefined });
    setActiveTabIndex(index);
  }, [selectToken, setActiveTabIndex]);

  const handleClickAssets = useCallback((slug: string) => {
    selectToken({ slug });
    setActiveTabIndex(TABS.findIndex((tab) => tab.id === 'activity'));
  }, [TABS, selectToken, setActiveTabIndex]);

  function renderCurrentTab(isActive: boolean) {
    switch (TABS[activeTabIndex].id) {
      case 'assets':
        return (
          <Assets
            isActive={isActive}
            onTokenClick={handleClickAssets}
            onStakedTokenClick={onStakedTokenClick}
          />
        );

      case 'activity':
        return <Activity isActive={isActive} />;

      case 'nft':
        return <Nfts isActive={isActive} />;

      default:
        return undefined;
    }
  }

  return (
    <div className={styles.container}>
      <TabList
        tabs={TABS}
        activeTab={activeTabIndex}
        onSwitchTab={handleSwitchTab}
        className={styles.tabs}
      />
      <Transition
        name="slide"
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

export default memo(Content);

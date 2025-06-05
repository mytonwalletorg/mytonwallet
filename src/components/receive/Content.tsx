import React, { memo, useMemo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiChain } from '../../api/types';
import type { Account } from '../../global/types';
import type { TabWithProperties } from '../ui/TabList';

import { selectAccount, selectCurrentAccountState } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';

import { useDeviceScreen } from '../../hooks/useDeviceScreen';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import TabList from '../ui/TabList';
import Transition from '../ui/Transition';
import TonActions from './content/TonActions';
import TonContent from './content/TonContent';
import TronActions from './content/TronActions';
import TronContent from './content/TronContent';

import styles from './ReceiveModal.module.scss';

interface StateProps {
  addressByChain?: Account['addressByChain'];
  isLedger?: boolean;
  chain?: ApiChain;
}

type OwnProps = {
  isOpen?: boolean;
  isStatic?: boolean;
  onClose?: NoneToVoidFunction;
};

export const TON_TAB_ID = 0;
export const TRON_TAB_ID = 1;

function Content({
  isOpen, addressByChain, chain, isStatic, isLedger, onClose,
}: StateProps & OwnProps) {
  const { setReceiveActiveTab } = getActions();

  // `lang.code` is used to force redrawing of the `Transition` content,
  // since the height of the content differs from translation to translation.
  const lang = useLang();
  const { isPortrait } = useDeviceScreen();

  const tabs = useMemo(() => {
    const result: TabWithProperties[] = [];
    if (addressByChain?.ton) {
      result.push({
        id: TON_TAB_ID,
        title: 'TON',
        className: styles.tab,
      });
    }
    if (addressByChain?.tron) {
      result.push({
        id: TRON_TAB_ID,
        title: 'TRON',
        className: styles.tab,
      });
    }

    return result;
  }, [addressByChain?.ton, addressByChain?.tron]);

  const activeTab = useMemo(() => {
    if (!chain) return tabs.length ? tabs[0].id : TON_TAB_ID;
    return chain === 'tron' ? TRON_TAB_ID : TON_TAB_ID;
  }, [chain, tabs]);

  const handleSwitchTab = useLastCallback((tabId: number) => {
    const newChain = tabId === TRON_TAB_ID ? 'tron' : 'ton';
    setReceiveActiveTab({ chain: newChain });
  });

  function renderActions() {
    const currentTab = tabs.find((tab) => tab.id === activeTab);
    if (currentTab?.id === TRON_TAB_ID) {
      return <TronActions isStatic />;
    }

    return <TonActions isStatic isLedger={isLedger} />;
  }

  function renderContent(isActive: boolean, isFrom: boolean, currentKey: number) {
    switch (currentKey) {
      case TON_TAB_ID:
        return (
          <TonContent
            isActive={isOpen && isActive}
            isStatic={isStatic}
            isLedger={isLedger}
            address={addressByChain!.ton!}
            onClose={onClose}
          />
        );

      case TRON_TAB_ID:
        return (
          <TronContent
            isActive={isOpen && isActive}
            isStatic={isStatic}
            address={addressByChain!.tron!}
            onClose={onClose}
          />
        );
    }
  }

  if (!tabs.length) {
    return undefined;
  }

  return (
    <>
      {isStatic && renderActions()}

      {tabs.length > 1 && (
        <TabList
          withBorder
          tabs={tabs}
          activeTab={activeTab}
          className={buildClassName(styles.tabs, !isStatic && styles.tabsInModal)}
          onSwitchTab={handleSwitchTab}
        />
      )}
      <Transition
        key={`content_${lang.code}`}
        activeKey={activeTab}
        name={isPortrait ? 'slide' : 'slideFade'}
        className={styles.contentWrapper}
        slideClassName={buildClassName(styles.content, isStatic && styles.contentStatic, 'custom-scroll')}
        shouldRestoreHeight={isStatic}
      >
        {renderContent}
      </Transition>
    </>
  );
}

export default memo(
  withGlobal<OwnProps>((global): StateProps => {
    const account = selectAccount(global, global.currentAccountId!);
    const { receiveModalChain } = selectCurrentAccountState(global) || {};

    return {
      addressByChain: account?.addressByChain,
      isLedger: Boolean(account?.ledger),
      chain: receiveModalChain,
    };
  },
  (global, _, stickToFirst) => stickToFirst(global.currentAccountId))(Content),
);

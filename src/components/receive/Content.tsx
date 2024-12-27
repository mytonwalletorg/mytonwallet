import React, { memo, useMemo, useState } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { ApiChain } from '../../api/types';
import type { TabWithProperties } from '../ui/TabList';

import { selectAccount } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';

import { useDeviceScreen } from '../../hooks/useDeviceScreen';
import useLang from '../../hooks/useLang';

import TabList from '../ui/TabList';
import Transition from '../ui/Transition';
import TonActions from './content/TonActions';
import TonContent from './content/TonContent';
import TronActions from './content/TronActions';
import TronContent from './content/TronContent';

import styles from './ReceiveModal.module.scss';

interface StateProps {
  addressByChain?: Record<ApiChain, string>;
  isLedger?: boolean;
}

type OwnProps = {
  isOpen?: boolean;
  isStatic?: boolean;
  onClose?: NoneToVoidFunction;
};

const TON_TAB_ID = 0;
const TRON_TAB_ID = 1;

function Content({
  isOpen, addressByChain, isStatic, isLedger, onClose,
}: StateProps & OwnProps) {
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

  const [activeTab, setActiveTab] = useState<number>(tabs.length ? tabs[0].id : 0);

  function renderActions() {
    if (tabs[activeTab]?.id === TRON_TAB_ID) {
      return <TronActions isStatic />;
    }

    return <TonActions isStatic isLedger={isLedger} />;
  }

  // eslint-disable-next-line consistent-return
  function renderContent(isActive: boolean, isFrom: boolean, currentKey: number) {
    switch (currentKey) {
      case TON_TAB_ID:
        return (
          <TonContent
            isActive={isOpen && isActive}
            isStatic={isStatic}
            isLedger={isLedger}
            address={addressByChain!.ton}
            onClose={onClose}
          />
        );

      case TRON_TAB_ID:
        return (
          <TronContent
            isActive={isOpen && isActive}
            isStatic={isStatic}
            address={addressByChain!.tron}
            onClose={onClose}
          />
        );
    }
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
          onSwitchTab={setActiveTab}
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

    return {
      addressByChain: account?.addressByChain,
      isLedger: Boolean(account?.ledger),
    };
  },
  (global, _, stickToFirst) => stickToFirst(global.currentAccountId))(Content),
);

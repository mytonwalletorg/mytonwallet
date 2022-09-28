import type { GlobalState } from '../../global/types';

import React, { memo, useCallback, useState } from '../../lib/teact/teact';
import { withGlobal, getActions } from '../../global';

import { IS_TESTNET } from '../../config';
import buildClassName from '../../util/buildClassName';
import useFlag from '../../hooks/useFlag';

import Card from './Card';
import TabList from '../ui/TabList';
import Header from './Header';
import TransferModal from '../transfer/TransferModal';
import Transition from '../ui/Transition';
import Assets from './Assets';
import Activity from './Activity';
import Nfts from './Nfts';
import Receive from './Receive';
import Notifications from './Notifications';
import BackupWarning from './BackupWarning';
import BackupModal from './BackupModal';
import SignatureModal from './SignatureModal';
import Button from '../ui/Button';
import TransactionModal from './TransactionModal';

import styles from './Main.module.scss';

type StateProps = Pick<GlobalState, 'currentTokenSlug'>;

const TABS = [
  { id: 'assets', title: 'Assets', className: styles.tab },
  { id: 'activity', title: 'Activity', className: styles.tab },
  { id: 'nft', title: 'NFT', className: styles.tab },
];

function Main({ currentTokenSlug }: StateProps) {
  const { startTransfer, selectToken } = getActions();

  const [activeTabIndex, setActiveTabIndex] = useState<number>(currentTokenSlug ? 1 : 0);
  const [isReceiveTonOpened, openReceiveTon, closeReceiveTon] = useFlag(false);
  const [isBackupWalletOpened, openBackupWallet, closeBackupWallet] = useFlag(false);

  const handleTokenCardClose = useCallback(() => {
    selectToken({ slug: undefined });
    setActiveTabIndex(0);
  }, [selectToken]);

  const handleSwitchTab = useCallback((index: number) => {
    selectToken({ slug: undefined });
    setActiveTabIndex(index);
  }, [selectToken]);

  const handleClickAssets = useCallback((slug: string) => {
    selectToken({ slug });
    setActiveTabIndex(TABS.findIndex((tab) => tab.id === 'activity'));
  }, [selectToken]);

  function renderCurrentTab(isActive: boolean) {
    switch (TABS[activeTabIndex].id) {
      case 'assets':
        return <Assets isActive={isActive} onTokenClick={handleClickAssets} />;

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
      <div className={styles.head}>
        {IS_TESTNET && <div className={styles.testnetWarning}>Testnet Version</div>}
        <BackupWarning onOpenBackupWallet={openBackupWallet} />
        <Header onOpenBackupWallet={openBackupWallet} />
        <Card onTokenCardClose={handleTokenCardClose} />
        <div className={styles.buttons}>
          <Button className={styles.button} onClick={openReceiveTon} isSimple>
            <i className={buildClassName(styles.buttonIcon, 'icon-receive')} aria-hidden />
            Receive
          </Button>
          <Button className={styles.button} onClick={startTransfer} isSimple>
            <i className={buildClassName(styles.buttonIcon, 'icon-send')} aria-hidden />
            Send
          </Button>
        </div>
        <BackupModal isOpen={isBackupWalletOpened} onClose={closeBackupWallet} />
      </div>
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
      <TransferModal />
      <SignatureModal />
      <TransactionModal />
      <Receive isOpen={isReceiveTonOpened} onClose={closeReceiveTon} />
      <Notifications />
    </div>
  );
}

export default memo(withGlobal((global) => {
  return {
    currentTokenSlug: global.currentTokenSlug,
  };
})(Main));

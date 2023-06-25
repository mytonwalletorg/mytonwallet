import React, { memo, useEffect } from '../lib/teact/teact';

import { AppState } from '../global/types';

import { INACTIVE_MARKER, IS_ELECTRON } from '../config';
import { getActions, withGlobal } from '../global';
import { setActiveTabChangeListener } from '../util/activeTabMonitor';
import buildClassName from '../util/buildClassName';
import { IS_LINUX } from '../util/windowEnvironment';
import { updateSizes } from '../util/windowSize';

import { useDeviceScreen } from '../hooks/useDeviceScreen';
import useFlag from '../hooks/useFlag';
import useSyncEffect from '../hooks/useSyncEffect';
import useTimeout from '../hooks/useTimeout';

import AppInactive from './AppInactive';
import Auth from './auth/Auth';
import DappConnectModal from './dapps/DappConnectModal';
import DappTransactionModal from './dapps/DappTransactionModal';
import Dialogs from './Dialogs';
import ElectronHeader from './electron/ElectronHeader';
import LedgerModal from './ledger/LedgerModal';
import Main from './main/Main';
import BackupModal from './main/modals/BackupModal';
import SignatureModal from './main/modals/SignatureModal';
import TransactionModal from './main/modals/TransactionModal';
import Notifications from './main/Notifications';
import Settings from './settings/Settings';
import SettingsModal from './settings/SettingsModal';
import TransferModal from './transfer/TransferModal';
import Transition from './ui/Transition';

// import Test from './components/test/TestNoRedundancy';
import styles from './App.module.scss';

interface StateProps {
  appState: AppState;
  accountId?: string;
  isBackupWalletModalOpen?: boolean;
  isHardwareModalOpen?: boolean;
  areSettingsOpen?: boolean;
}

const PRERENDER_MAIN_DELAY = 1200;
let mainKey = 0;

function App({
  appState,
  accountId,
  isBackupWalletModalOpen,
  isHardwareModalOpen,
  areSettingsOpen,
}: StateProps) {
  // return <Test />;
  const {
    closeBackupWalletModal,
    closeHardwareWalletModal,
    closeSettings,
    cancelCaching,
  } = getActions();
  const { isPortrait } = useDeviceScreen();
  const areSettingsInModal = !isPortrait || IS_ELECTRON;

  const [isInactive, markInactive] = useFlag(false);
  const [canPrerenderMain, prerenderMain] = useFlag();

  const renderingKey = isInactive
    ? AppState.Inactive
    : ((areSettingsOpen && !areSettingsInModal) ? AppState.Settings : appState);

  useTimeout(
    prerenderMain,
    renderingKey === AppState.Auth && !canPrerenderMain ? PRERENDER_MAIN_DELAY : undefined,
  );

  useEffect(() => {
    updateSizes();
    setActiveTabChangeListener(() => {
      document.title = `MyTonWallet ${INACTIVE_MARKER}`;

      markInactive();
      closeSettings();
      cancelCaching();
    });
  }, [markInactive]);

  useSyncEffect(() => {
    if (accountId) {
      mainKey += 1;
    }
  }, [accountId]);

  // eslint-disable-next-line consistent-return
  function renderContent(isActive: boolean, isFrom: boolean, currentKey: number) {
    switch (currentKey) {
      case AppState.Auth:
        return <Auth />;
      case AppState.Main:
        return (
          <Transition
            name="semiFade"
            activeKey={mainKey}
            shouldCleanup
            nextKey={renderingKey === AppState.Auth && canPrerenderMain ? mainKey + 1 : undefined}
            slideClassName={buildClassName(styles.appSlide, styles.appSlideContent, 'custom-scroll')}
          >
            <Main key={mainKey} />
          </Transition>
        );
      case AppState.Settings:
        return <Settings />;
      case AppState.Ledger:
        return <LedgerModal isOpen onClose={handleCloseBrowserTab} />;
      case AppState.Inactive:
        return <AppInactive />;
    }
  }

  return (
    <>
      {IS_ELECTRON && !IS_LINUX && <ElectronHeader withTitle />}

      <Transition
        name={isPortrait ? 'pushSlide' : 'semiFade'}
        activeKey={renderingKey}
        shouldCleanup
        className={styles.transitionContainer}
        slideClassName={buildClassName(styles.appSlide, 'custom-scroll')}
      >
        {renderContent}
      </Transition>

      {areSettingsInModal && (
        <SettingsModal
          isOpen={areSettingsOpen}
          onClose={closeSettings}
        >
          <Settings isInsideModal />
        </SettingsModal>
      )}
      {!isInactive && (
        <>
          <LedgerModal isOpen={isHardwareModalOpen} onClose={closeHardwareWalletModal} />
          <BackupModal
            isOpen={isBackupWalletModalOpen}
            onClose={closeBackupWalletModal}
          />
          <TransferModal />
          <SignatureModal />
          <TransactionModal />
          <DappConnectModal />
          <DappTransactionModal />
          <Notifications />
          <Dialogs />
        </>
      )}
    </>
  );
}

export default memo(withGlobal((global): StateProps => {
  return {
    appState: global.appState,
    accountId: global.currentAccountId,
    isBackupWalletModalOpen: global.isBackupWalletModalOpen,
    isHardwareModalOpen: global.isHardwareModalOpen,
    areSettingsOpen: global.areSettingsOpen,
  };
})(App));

async function handleCloseBrowserTab() {
  const tab = await chrome.tabs.getCurrent();
  chrome.tabs.remove(tab.id!);
}

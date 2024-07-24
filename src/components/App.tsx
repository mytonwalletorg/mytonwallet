import React, { memo, useEffect, useLayoutEffect } from '../lib/teact/teact';
import { getActions, withGlobal } from '../global';

import { AppState } from '../global/types';

import { INACTIVE_MARKER, IS_ANDROID_DIRECT, IS_CAPACITOR } from '../config';
import { setActiveTabChangeListener } from '../util/activeTabMonitor';
import buildClassName from '../util/buildClassName';
import { resolveRender } from '../util/renderPromise';
import {
  IS_ANDROID,
  IS_DELEGATED_BOTTOM_SHEET,
  IS_DELEGATING_BOTTOM_SHEET,
  IS_ELECTRON,
  IS_IOS,
  IS_LINUX,
} from '../util/windowEnvironment';
import { updateSizes } from '../util/windowSize';
import { callApi } from '../api';

import useBackgroundMode from '../hooks/useBackgroundMode';
import { useDeviceScreen } from '../hooks/useDeviceScreen';
import useFlag from '../hooks/useFlag';
import useInterval from '../hooks/useInterval';
import useSyncEffect from '../hooks/useSyncEffect';
import useTimeout from '../hooks/useTimeout';

import AppInactive from './AppInactive';
import Auth from './auth/Auth';
import DappConnectModal from './dapps/DappConnectModal';
import DappTransferModal from './dapps/DappTransferModal';
import Dialogs from './Dialogs';
import ElectronHeader from './electron/ElectronHeader';
import LedgerModal from './ledger/LedgerModal';
import Main from './main/Main';
import AddAccountModal from './main/modals/AddAccountModal';
import BackupModal from './main/modals/BackupModal';
import OnRampWidgetModal from './main/modals/OnRampWidgetModal';
import QrScannerModal from './main/modals/QrScannerModal';
import SignatureModal from './main/modals/SignatureModal';
import SwapActivityModal from './main/modals/SwapActivityModal';
import TransactionModal from './main/modals/TransactionModal';
import UnhideNftModal from './main/modals/UnhideNftModal';
import Notifications from './main/Notifications';
import MediaViewer from './mediaViewer/MediaViewer';
import Settings from './settings/Settings';
import SettingsModal from './settings/SettingsModal';
import SwapModal from './swap/SwapModal';
import TransferModal from './transfer/TransferModal';
import ConfettiContainer from './ui/ConfettiContainer';
import InAppBrowser from './ui/InAppBrowser';
import LoadingOverlay from './ui/LoadingOverlay';
import Transition from './ui/Transition';

// import Test from './components/test/TestNoRedundancy';
import styles from './App.module.scss';

interface StateProps {
  appState: AppState;
  accountId?: string;
  isBackupWalletModalOpen?: boolean;
  isQrScannerOpen?: boolean;
  isHardwareModalOpen?: boolean;
  areSettingsOpen?: boolean;
  isMediaViewerOpen?: boolean;
}

const APP_UPDATE_INTERVAL = (IS_ELECTRON && !IS_LINUX) || IS_ANDROID_DIRECT
  ? 5 * 60 * 1000 // 5 min
  : undefined;
const PRERENDER_MAIN_DELAY = 1200;
let mainKey = 0;

function App({
  appState,
  accountId,
  isBackupWalletModalOpen,
  isHardwareModalOpen,
  isQrScannerOpen,
  areSettingsOpen,
  isMediaViewerOpen,
}: StateProps) {
  // return <Test />;
  const {
    closeBackupWalletModal,
    closeHardwareWalletModal,
    closeSettings,
    cancelCaching,
    closeQrScanner,
    checkAppVersion,
  } = getActions();

  const { isPortrait } = useDeviceScreen();
  const areSettingsInModal = !isPortrait || IS_ELECTRON || IS_DELEGATING_BOTTOM_SHEET || IS_DELEGATED_BOTTOM_SHEET;

  const [isInactive, markInactive] = useFlag(false);
  const [canPrerenderMain, prerenderMain] = useFlag();

  const renderingKey = isInactive
    ? AppState.Inactive
    : ((areSettingsOpen && !areSettingsInModal)
      ? AppState.Settings : appState
    );

  useTimeout(
    prerenderMain,
    renderingKey === AppState.Auth && !canPrerenderMain ? PRERENDER_MAIN_DELAY : undefined,
  );

  useInterval(checkAppVersion, APP_UPDATE_INTERVAL);

  useEffect(() => {
    updateSizes();
    setActiveTabChangeListener(() => {
      document.title = `MyTonWallet ${INACTIVE_MARKER}`;

      markInactive();
      closeSettings();
      cancelCaching();
    });
  }, [markInactive]);

  useBackgroundMode(() => {
    void callApi('setIsAppFocused', false);
  }, () => {
    void callApi('setIsAppFocused', true);
  });

  useLayoutEffect(() => {
    document.documentElement.classList.add('is-rendered');
    resolveRender();
  }, []);

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
      case AppState.Main: {
        const slideFullClassName = buildClassName(
          styles.appSlide,
          styles.appSlideContent,
          'custom-scroll',
          'app-slide-content',
        );
        return (
          <Transition
            name="semiFade"
            activeKey={mainKey}
            shouldCleanup
            nextKey={renderingKey === AppState.Auth && canPrerenderMain ? mainKey + 1 : undefined}
            slideClassName={slideFullClassName}
          >
            <Main
              key={mainKey}
              isActive={isActive}
            />
          </Transition>
        );
      }
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
        name={isPortrait ? (IS_ANDROID ? 'slideFadeAndroid' : IS_IOS ? 'slideLayers' : 'slideFade') : 'semiFade'}
        activeKey={renderingKey}
        shouldCleanup={renderingKey !== AppState.Settings && !isMediaViewerOpen}
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
      <MediaViewer />
      {!isInactive && (
        <>
          <LedgerModal isOpen={isHardwareModalOpen} onClose={closeHardwareWalletModal} />
          <BackupModal
            isOpen={isBackupWalletModalOpen}
            onClose={closeBackupWalletModal}
          />
          <TransferModal />
          <SwapModal />
          <SignatureModal />
          <TransactionModal />
          <SwapActivityModal />
          <DappConnectModal />
          <DappTransferModal />
          <AddAccountModal />
          <OnRampWidgetModal />
          <UnhideNftModal />
          {!IS_DELEGATED_BOTTOM_SHEET && <Notifications />}
          {IS_CAPACITOR && (
            <QrScannerModal
              isOpen={isQrScannerOpen}
              onClose={closeQrScanner}
            />
          )}
          {!IS_DELEGATED_BOTTOM_SHEET && <Dialogs />}
          {!IS_DELEGATED_BOTTOM_SHEET && <ConfettiContainer />}
          {IS_CAPACITOR && !IS_DELEGATED_BOTTOM_SHEET && <InAppBrowser />}
          {!IS_DELEGATED_BOTTOM_SHEET && <LoadingOverlay />}
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
    isMediaViewerOpen: Boolean(global.mediaViewer.mediaId),
    isQrScannerOpen: global.isQrScannerOpen,
  };
})(App));

async function handleCloseBrowserTab() {
  const tab = await chrome.tabs.getCurrent();
  await chrome.tabs.remove(tab.id!);
}

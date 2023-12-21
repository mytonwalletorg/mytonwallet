import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import React, { memo, useEffect, useState } from '../lib/teact/teact';
import { getActions, withGlobal } from '../global';

import { AppState } from '../global/types';

import { INACTIVE_MARKER, IS_CAPACITOR } from '../config';
import { setActiveTabChangeListener } from '../util/activeTabMonitor';
import buildClassName from '../util/buildClassName';
import {
  IS_ANDROID, IS_DELEGATED_BOTTOM_SHEET, IS_DELEGATING_BOTTOM_SHEET, IS_ELECTRON, IS_IOS, IS_LINUX,
} from '../util/windowEnvironment';
import { updateSizes } from '../util/windowSize';

import { useDeviceScreen } from '../hooks/useDeviceScreen';
import useEffectOnce from '../hooks/useEffectOnce';
import useFlag from '../hooks/useFlag';
import useLang from '../hooks/useLang';
import useLastCallback from '../hooks/useLastCallback';
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
import AddAccountModal from './main/modals/AddAccountModal';
import BackupModal from './main/modals/BackupModal';
import QrScannerModal from './main/modals/QrScannerModal';
import SignatureModal from './main/modals/SignatureModal';
import SwapActivityModal from './main/modals/SwapActivityModal';
import TransactionModal from './main/modals/TransactionModal';
import Notifications from './main/Notifications';
import Settings from './settings/Settings';
import SettingsModal from './settings/SettingsModal';
import SwapModal from './swap/SwapModal';
import TransferModal from './transfer/TransferModal';
import ConfettiContainer from './ui/ConfettiContainer';
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
}

const PRERENDER_MAIN_DELAY = 1200;
let mainKey = 0;

function App({
  appState,
  accountId,
  isBackupWalletModalOpen,
  isHardwareModalOpen,
  isQrScannerOpen,
  areSettingsOpen,
}: StateProps) {
  // return <Test />;
  const {
    closeBackupWalletModal,
    closeHardwareWalletModal,
    closeSettings,
    cancelCaching,
    openQrScanner,
    closeQrScanner,
    showNotification,
    openDeeplink,
  } = getActions();

  const lang = useLang();
  const { isPortrait } = useDeviceScreen();
  const areSettingsInModal = !isPortrait || IS_ELECTRON || IS_DELEGATING_BOTTOM_SHEET || IS_DELEGATED_BOTTOM_SHEET;
  const [isBarcodeSupported, setIsBarcodeSupported] = useState<boolean>(false);

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

  useEffectOnce(() => {
    if (!IS_CAPACITOR) return;

    BarcodeScanner
      .isSupported()
      .then((result) => {
        setIsBarcodeSupported(result.supported);
      });
  });

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

  const handleOpenQrScanner = useLastCallback(async () => {
    const granted = await requestCameraPermissions();

    if (!granted) {
      showNotification({
        message: lang('Permission denied. Please grant camera permission to use the QR code scanner.'),
      });
      return;
    }

    openQrScanner();
  });

  const handleQrScan = useLastCallback((scanResult) => {
    openDeeplink({ url: scanResult });
  });

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
              onQrScanPress={isBarcodeSupported ? handleOpenQrScanner : undefined}
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
        shouldCleanup={renderingKey !== AppState.Settings}
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
          <TransferModal onQrScanPress={isBarcodeSupported ? handleOpenQrScanner : undefined} />
          <SwapModal />
          <SignatureModal />
          <TransactionModal />
          <SwapActivityModal />
          <DappConnectModal />
          <DappTransactionModal />
          <AddAccountModal />
          {!IS_DELEGATED_BOTTOM_SHEET && <Notifications />}
          {IS_CAPACITOR && (
            <QrScannerModal
              isOpen={isQrScannerOpen}
              onClose={closeQrScanner}
              onScan={handleQrScan}
            />
          )}
          <Dialogs />
          {!IS_DELEGATED_BOTTOM_SHEET && <ConfettiContainer />}
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
    isQrScannerOpen: global.isQrScannerOpen,
  };
})(App));

async function handleCloseBrowserTab() {
  const tab = await chrome.tabs.getCurrent();
  await chrome.tabs.remove(tab.id!);
}

async function requestCameraPermissions(): Promise<boolean> {
  const { camera } = await BarcodeScanner.requestPermissions();

  return camera === 'granted' || camera === 'limited';
}

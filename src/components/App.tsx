import React, { memo, useEffect, useLayoutEffect } from '../lib/teact/teact';
import { getActions, withGlobal } from '../global';

import type { Theme } from '../global/types';
import { AppState, ContentTab } from '../global/types';

import { INACTIVE_MARKER, IS_ANDROID_DIRECT, IS_CAPACITOR } from '../config';
import { selectCurrentAccountSettings, selectCurrentAccountState } from '../global/selectors';
import { useAccentColor } from '../util/accentColor';
import { setActiveTabChangeListener } from '../util/activeTabMonitor';
import buildClassName from '../util/buildClassName';
import { MINUTE } from '../util/dateFormat';
import { resolveRender } from '../util/renderPromise';
import {
  IS_ANDROID, IS_DELEGATED_BOTTOM_SHEET, IS_ELECTRON, IS_IOS, IS_LINUX,
} from '../util/windowEnvironment';
import { updateSizes } from '../util/windowSize';
import { callApi } from '../api';

import useAppTheme from '../hooks/useAppTheme';
import useBackgroundMode from '../hooks/useBackgroundMode';
import { useDeviceScreen } from '../hooks/useDeviceScreen';
import useFlag from '../hooks/useFlag';
import useInterval from '../hooks/useInterval';
import useSyncEffect from '../hooks/useSyncEffect';
import useTimeout from '../hooks/useTimeout';

import AppInactive from './AppInactive';
import AppLocked from './AppLocked';
import Auth from './auth/Auth';
import DappConnectModal from './dapps/DappConnectModal';
import DappTransferModal from './dapps/DappTransferModal';
import Dialogs from './Dialogs';
import ElectronHeader from './electron/ElectronHeader';
import Explore from './explore/Explore';
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
import BottomBar from './main/sections/Actions/BottomBar';
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
  isExploreOpen?: boolean;
  areSettingsOpen?: boolean;
  theme: Theme;
  accentColorIndex?: number;
}

const APP_STATES_WITH_BOTTOM_BAR = new Set([AppState.Main, AppState.Settings, AppState.Explore]);
const APP_UPDATE_INTERVAL = (IS_ELECTRON && !IS_LINUX) || IS_ANDROID_DIRECT
  ? 5 * MINUTE
  : undefined;
const PRERENDER_MAIN_DELAY = 1200;
let mainKey = 0;

const APP_STATE_RENDER_COUNT = Object.keys(AppState).length / 2;

function App({
  appState,
  accountId,
  isBackupWalletModalOpen,
  isHardwareModalOpen,
  isQrScannerOpen,
  isExploreOpen,
  areSettingsOpen,
  theme,
  accentColorIndex,
}: StateProps) {
  const {
    closeBackupWalletModal,
    closeHardwareWalletModal,
    closeSettings,
    cancelCaching,
    closeQrScanner,
    checkAppVersion,
  } = getActions();

  const { isPortrait } = useDeviceScreen();
  const areSettingsInModal = !isPortrait;

  const [isInactive, markInactive] = useFlag(false);
  const [canPrerenderMain, prerenderMain] = useFlag();

  const renderingKey = isInactive
    ? AppState.Inactive
    : areSettingsOpen && !areSettingsInModal
      ? AppState.Settings
      : isExploreOpen && isPortrait
        ? AppState.Explore : appState;
  const withBottomBar = isPortrait && APP_STATES_WITH_BOTTOM_BAR.has(renderingKey);
  const transitionName = withBottomBar
    ? 'semiFade'
    : isPortrait
      ? (IS_ANDROID ? 'slideFadeAndroid' : IS_IOS ? 'slideLayers' : 'slideFade')
      : 'semiFade';

  useTimeout(
    prerenderMain,
    renderingKey === AppState.Auth && !canPrerenderMain ? PRERENDER_MAIN_DELAY : undefined,
  );

  useInterval(checkAppVersion, APP_UPDATE_INTERVAL);

  useEffect(() => {
    document.documentElement.classList.toggle('with-bottombar', withBottomBar);
  }, [withBottomBar]);

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

  const appTheme = useAppTheme(theme);
  useAccentColor('body', appTheme, accentColorIndex);

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
      case AppState.Explore:
        return <Explore isActive={isActive} />;
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
        name={transitionName}
        activeKey={renderingKey}
        renderCount={APP_STATE_RENDER_COUNT}
        shouldCleanup={!withBottomBar}
        className={styles.transitionContainer}
        slideClassName={
          buildClassName(styles.appSlide, withBottomBar && styles.appSlide_fastTransition, 'custom-scroll')
        }
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
      <AppLocked />
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
      {withBottomBar && <BottomBar />}
    </>
  );
}

export default memo(withGlobal((global): StateProps => {
  const { activeContentTab } = selectCurrentAccountState(global) ?? {};

  return {
    appState: global.appState,
    accountId: global.currentAccountId,
    isBackupWalletModalOpen: global.isBackupWalletModalOpen,
    isHardwareModalOpen: global.isHardwareModalOpen,
    isExploreOpen: !global.areSettingsOpen && activeContentTab === ContentTab.Explore,
    areSettingsOpen: global.areSettingsOpen,
    isQrScannerOpen: global.isQrScannerOpen,
    theme: global.settings.theme,
    accentColorIndex: selectCurrentAccountSettings(global)?.accentColorIndex,
  };
})(App));

async function handleCloseBrowserTab() {
  const tab = await chrome.tabs.getCurrent();
  if (!tab?.id) return;
  await chrome.tabs.remove(tab.id);
}

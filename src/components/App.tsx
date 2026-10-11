import React, { memo, useEffect, useLayoutEffect } from '../lib/teact/teact';
import { getActions, withGlobal } from '../global';

import type { Theme } from '../global/types';
import { AppState } from '../global/types';

import {
  APP_NAME,
  INACTIVE_MARKER,
  IS_ANDROID_DIRECT,
  IS_CAPACITOR,
} from '../config';
import { selectCurrentAccountId, selectCurrentAccountSettings, selectCurrentAccountState } from '../global/selectors';
import { useAccentColor } from '../util/accentColor';
import { setActiveTabChangeListener } from '../util/activeTabMonitor';
import buildClassName from '../util/buildClassName';
import { MINUTE } from '../util/dateFormat';
import { resolveRender } from '../util/renderPromise';
import resolveSlideTransitionName from '../util/resolveSlideTransitionName';
import {
  IS_ELECTRON, IS_LINUX,
} from '../util/windowEnvironment';
import { updateSizes } from '../util/windowSize';
import { callApi } from '../api';
import { TransactionInfoModal, TransactionModal } from './main/modals/transaction';
import IFrameBrowser from './ui/IFrameBrowser';

import { useAppIntersectionObserver } from '../hooks/useAppIntersectionObserver';
import useAppTheme from '../hooks/useAppTheme';
import useBackgroundMode from '../hooks/useBackgroundMode';
import { useDeviceScreen } from '../hooks/useDeviceScreen';
import useFlag from '../hooks/useFlag';
import useInterval from '../hooks/useInterval';
import useSyncEffect from '../hooks/useSyncEffect';
import useTimeout from '../hooks/useTimeout';

import AppEmpty from './AppEmpty';
import AppInactive from './AppInactive';
import AppLocked from './appLocked/AppLocked';
import Auth from './auth/Auth';
import AuthImportWalletModal from './auth/AuthImportWalletModal';
import DappConnectModal from './dapps/DappConnectModal';
import DappSignDataModal from './dapps/DappSignDataModal';
import DappTransferModal from './dapps/DappTransferModal';
import Dialogs from './Dialogs';
import ElectronHeader from './electron/ElectronHeader';
import ExchangeModal from './exchange/ExchangeModal';
import Explore from './explore/Explore';
import Main from './main/Main';
import BackupModal from './main/modals/BackupModal';
import NftAttributesModal from './main/modals/NftAttributesModal';
import QrScannerModal from './main/modals/QrScannerModal';
import SignatureModal from './main/modals/SignatureModal';
import UnhideNftModal from './main/modals/UnhideNftModal';
import BottomBar from './main/sections/Actions/BottomBar';
import Toasts from './main/Toasts';
import WalletRenameModal from './main/WalletRenameModal';
import MediaViewer from './mediaViewer/MediaViewer';
import Settings from './settings/Settings';
import TokenInfo from './tokenInfo/TokenInfo';
import TransferModal from './transfer/TransferModal';
import ConfettiContainer from './ui/ConfettiContainer';
import InAppBrowser from './ui/InAppBrowser';
import LoadingOverlay from './ui/LoadingOverlay';
import Transition from './ui/Transition';
import WalletConnectPayDataCollectionModal from './walletConnectPay/WalletConnectPayDataCollectionModal';
import WalletConnectPayModal from './walletConnectPay/WalletConnectPayModal';
import WalletConnectPayOptionSelectionModal from './walletConnectPay/WalletConnectPayOptionSelectionModal';

// import Test from './components/test/TestNoRedundancy';
import styles from './App.module.scss';

interface StateProps {
  appState: AppState;
  accountId?: string;
  isBackupWalletModalOpen?: boolean;
  isQrScannerOpen?: boolean;
  isExploreOpen?: boolean;
  currentTokenSlug?: string;
  isFullscreen: boolean;
  areSettingsOpen?: boolean;
  theme: Theme;
  accentColorIndex?: number;
  isAppReady?: boolean;
}

const APP_STATES_WITH_BOTTOM_BAR = new Set([
  AppState.Main, AppState.Settings, AppState.Explore, AppState.TokenInfo,
]);
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
  isQrScannerOpen,
  isExploreOpen,
  currentTokenSlug,
  isFullscreen,
  areSettingsOpen,
  theme,
  accentColorIndex,
  isAppReady,
}: StateProps) {
  const {
    closeBackupWalletModal,
    closeSettings,
    cancelCaching,
    closeQrScanner,
    checkAppVersion,
  } = getActions();

  const { isPortrait } = useDeviceScreen();

  const [isInactive, markInactive] = useFlag(false);
  const [canPrerenderMain, prerenderMain] = useFlag();

  const renderingKey = resolveRenderingKey({
    isInactive, areSettingsOpen, isExploreOpen, currentTokenSlug, isPortrait, appState,
  });
  const withBottomBar = isPortrait && APP_STATES_WITH_BOTTOM_BAR.has(renderingKey);
  // Screens sharing the bottom bar are sibling tabs, so they cross-fade into each other. The token
  // screen is the exception: the bar stays visible, but the transition slides in.
  const withSlide = isPortrait && (!withBottomBar || renderingKey === AppState.TokenInfo);
  const transitionName = withSlide ? resolveSlideTransitionName() : 'semiFade';

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
      document.title = `${APP_NAME} ${INACTIVE_MARKER}`;

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
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('is-fullscreen', isFullscreen);
    requestAnimationFrame(updateSizes);
  }, [isFullscreen]);

  useSyncEffect(() => {
    if (accountId) {
      mainKey += 1;
    }
  }, [accountId]);

  const appTheme = useAppTheme(theme);
  useAccentColor('body', appTheme, accentColorIndex);

  useAppIntersectionObserver();

  function renderContent(isActive: boolean, isFrom: boolean, currentKey: AppState) {
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
        return <Settings isActive={isActive} />;
      case AppState.TokenInfo:
        return <TokenInfo isActive={isActive} />;
      case AppState.Inactive:
        return <AppInactive />;
      case AppState.Empty:
        return <AppEmpty />;
    }
  }

  return (
    <>
      {IS_ELECTRON && <ElectronHeader withTitle />}

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

      <AppLocked />
      <MediaViewer />
      {!isInactive && (
        <>
          <AuthImportWalletModal />
          <BackupModal
            isOpen={isBackupWalletModalOpen}
            onClose={closeBackupWalletModal}
          />
          <TransferModal />
          <ExchangeModal />
          <SignatureModal />
          <TransactionModal />
          <TransactionInfoModal />
          <DappConnectModal />
          <DappSignDataModal />
          <DappTransferModal />
          <WalletConnectPayModal />
          <WalletConnectPayOptionSelectionModal />
          <WalletConnectPayDataCollectionModal />
          <UnhideNftModal />
          <NftAttributesModal />
          {IS_CAPACITOR && (
            <QrScannerModal
              isOpen={isQrScannerOpen}
              onClose={closeQrScanner}
            />
          )}
          <Toasts />
          <WalletRenameModal />
          <Dialogs />
          <ConfettiContainer />
          {IS_CAPACITOR ? <InAppBrowser /> : <IFrameBrowser />}
          <LoadingOverlay />
        </>
      )}
      {withBottomBar && <BottomBar />}
    </>
  );
}

export default memo(withGlobal((global): StateProps => {
  return {
    appState: global.appState,
    accountId: selectCurrentAccountId(global),
    isBackupWalletModalOpen: global.isBackupWalletModalOpen,
    isExploreOpen: global.isExploreOpen,
    currentTokenSlug: selectCurrentAccountState(global)?.currentTokenSlug,
    areSettingsOpen: global.areSettingsOpen,
    isQrScannerOpen: global.isQrScannerOpen,
    isFullscreen: Boolean(global.isFullscreen),
    theme: global.settings.theme,
    accentColorIndex: selectCurrentAccountSettings(global)?.accentColorIndex,
    isAppReady: selectCurrentAccountState(global)?.isAppReady,
  };
})(App));

function resolveRenderingKey({
  isInactive, areSettingsOpen, isExploreOpen, currentTokenSlug, isPortrait, appState,
}: {
  isInactive: boolean;
  areSettingsOpen?: boolean;
  isExploreOpen?: boolean;
  currentTokenSlug?: string;
  isPortrait: boolean;
  appState: AppState;
}) {
  if (isInactive) return AppState.Inactive;
  if (areSettingsOpen && isPortrait) return AppState.Settings;
  if (isExploreOpen && isPortrait) return AppState.Explore;
  // In landscape the token screen lives inside the main content, next to the wallet overview
  if (currentTokenSlug && isPortrait && appState === AppState.Main) return AppState.TokenInfo;
  return appState;
}

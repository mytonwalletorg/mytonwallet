import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiTonWalletVersion } from '../../api/chains/ton/types';
import type { ApiDapp, ApiWalletInfo } from '../../api/types';
import type {
  Account, GlobalState, HardwareConnectState, UserToken,
} from '../../global/types';
import type { LedgerWalletInfo } from '../../util/ledger/types';
import type { Wallet } from './SettingsWalletVersion';
import { SettingsState } from '../../global/types';

import {
  APP_ENV_MARKER,
  APP_NAME,
  APP_VERSION,
  IS_CAPACITOR,
  IS_EXTENSION,
  LANG_LIST,
  PROXY_HOSTS,
  SUPPORT_USERNAME,
  TELEGRAM_WEB_URL,
  TONCOIN,
} from '../../config';
import {
  selectCurrentAccountState,
  selectCurrentAccountTokens,
  selectIsHardwareAccount,
  selectNetworkAccounts,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import { toBig, toDecimal } from '../../util/decimals';
import { formatCurrency, getShortCurrencySymbol } from '../../util/formatNumber';
import { MEMO_EMPTY_ARRAY } from '../../util/memo';
import { openUrl } from '../../util/openUrl';
import resolveSlideTransitionName from '../../util/resolveSlideTransitionName';
import { captureControlledSwipe } from '../../util/swipeController';
import {
  IS_BIOMETRIC_AUTH_SUPPORTED,
  IS_DAPP_SUPPORTED,
  IS_DELEGATED_BOTTOM_SHEET,
  IS_DELEGATING_BOTTOM_SHEET,
  IS_ELECTRON,
  IS_LEDGER_SUPPORTED,
  IS_TOUCH_ENV,
  IS_WEB,
} from '../../util/windowEnvironment';

import { useDeviceScreen } from '../../hooks/useDeviceScreen';
import useFlag from '../../hooks/useFlag';
import useHideBottomBar from '../../hooks/useHideBottomBar';
import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useModalTransitionKeys from '../../hooks/useModalTransitionKeys';
import usePrevious2 from '../../hooks/usePrevious2';
import useScrolledState from '../../hooks/useScrolledState';
import useShowTransition from '../../hooks/useShowTransition';
import { useStateRef } from '../../hooks/useStateRef';

import LedgerConnect from '../ledger/LedgerConnect';
import LedgerSelectWallets from '../ledger/LedgerSelectWallets';
import LogOutModal from '../main/modals/LogOutModal';
import Button from '../ui/Button';
import ModalHeader from '../ui/ModalHeader';
import Switcher from '../ui/Switcher';
import Transition from '../ui/Transition';
import Biometrics from './biometrics/Biometrics';
import SettingsNativeBiometricsTurnOn from './biometrics/NativeBiometricsTurnOn';
import SettingsAbout from './SettingsAbout';
import SettingsAppearance from './SettingsAppearance';
import SettingsAssets from './SettingsAssets';
import SettingsDapps from './SettingsDapps';
import SettingsDeveloperOptions from './SettingsDeveloperOptions';
import SettingsDisclaimer from './SettingsDisclaimer';
import SettingsHiddenNfts from './SettingsHiddenNfts';
import SettingsLanguage from './SettingsLanguage';
import SettingsPushNotifications from './SettingsPushNotifications';
import SettingsSecurity from './SettingsSecurity';
import SettingsTokenList from './SettingsTokenList';
import SettingsWalletVersion from './SettingsWalletVersion';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Settings.module.scss';

import aboutImg from '../../assets/settings/settings_about.svg';
import appearanceImg from '../../assets/settings/settings_appearance.svg';
import assetsActivityImg from '../../assets/settings/settings_assets-activity.svg';
import connectedDappsImg from '../../assets/settings/settings_connected-dapps.svg';
import disclaimerImg from '../../assets/settings/settings_disclaimer.svg';
import exitImg from '../../assets/settings/settings_exit.svg';
import installAppImg from '../../assets/settings/settings_install-app.svg';
import installDesktopImg from '../../assets/settings/settings_install-desktop.svg';
import installMobileImg from '../../assets/settings/settings_install-mobile.svg';
import languageImg from '../../assets/settings/settings_language.svg';
import ledgerImg from '../../assets/settings/settings_ledger.svg';
import mtwCardsImg from '../../assets/settings/settings_mtw-cards.svg';
import notifications from '../../assets/settings/settings_notifications.svg';
import securityImg from '../../assets/settings/settings_security.svg';
import supportImg from '../../assets/settings/settings_support.svg';
import telegramImg from '../../assets/settings/settings_telegram-menu.svg';
import tonLinksImg from '../../assets/settings/settings_ton-links.svg';
import tonMagicImg from '../../assets/settings/settings_ton-magic.svg';
import tonProxyImg from '../../assets/settings/settings_ton-proxy.svg';
import walletVersionImg from '../../assets/settings/settings_wallet-version.svg';

type OwnProps = {
  isInsideModal?: boolean;
};

type StateProps = {
  settings: GlobalState['settings'];
  dapps: ApiDapp[];
  isOpen?: boolean;
  tokens?: UserToken[];
  isHardwareAccount?: boolean;
  currentVersion?: ApiTonWalletVersion;
  versions?: ApiWalletInfo[];
  isCopyStorageEnabled?: boolean;
  supportAccountsCount?: number;
  hardwareWallets?: LedgerWalletInfo[];
  accounts?: Record<string, Account>;
  hardwareState?: HardwareConnectState;
  isLedgerConnected?: boolean;
  isTonAppConnected?: boolean;
  isRemoteTab?: boolean;
};

const AMOUNT_OF_CLICKS_FOR_DEVELOPERS_MODE = 5;
const SUPPORT_ACCOUNTS_COUNT_DEFAULT = 1;
const MTW_CARDS_WEBSITE = 'https://cards.mytonwallet.io';

function Settings({
  settings: {
    state,
    theme,
    animationLevel,
    isTestnet,
    langCode,
    isTonProxyEnabled,
    isTonMagicEnabled,
    isDeeplinkHookEnabled,
    baseCurrency,
  },
  dapps,
  isOpen = false,
  tokens,
  isInsideModal,
  isHardwareAccount,
  currentVersion,
  versions,
  isCopyStorageEnabled,
  supportAccountsCount = SUPPORT_ACCOUNTS_COUNT_DEFAULT,
  accounts,
  hardwareWallets,
  hardwareState,
  isLedgerConnected,
  isTonAppConnected,
  isRemoteTab,
}: OwnProps & StateProps) {
  const {
    setSettingsState,
    openSettingsHardwareWallet,
    closeSettings,
    toggleDeeplinkHook,
    toggleTonProxy,
    toggleTonMagic,
    getDapps,
    clearIsPinAccepted,
    afterSelectHardwareWallets,
  } = getActions();

  const lang = useLang();
  const { isPortrait } = useDeviceScreen();
  // eslint-disable-next-line no-null/no-null
  const transitionRef = useRef<HTMLDivElement>(null);
  const { renderingKey } = useModalTransitionKeys(state, isOpen);
  const [clicksAmount, setClicksAmount] = useState<number>(isTestnet ? AMOUNT_OF_CLICKS_FOR_DEVELOPERS_MODE : 0);
  const prevRenderingKeyRef = useStateRef(usePrevious2(renderingKey));

  const [isDeveloperModalOpen, openDeveloperModal, closeDeveloperModal] = useFlag();
  const [isLogOutModalOpened, openLogOutModal, closeLogOutModal] = useFlag();
  const isInitialScreen = renderingKey === SettingsState.Initial;

  const activeLang = useMemo(() => LANG_LIST.find((l) => l.langCode === langCode), [langCode]);

  const shortBaseSymbol = getShortCurrencySymbol(baseCurrency);

  const tonToken = useMemo(() => tokens?.find(({ slug }) => slug === TONCOIN.slug), [tokens]);

  const wallets = useMemo(() => {
    return versions?.map((v) => {
      const tonBalance = formatCurrency(toDecimal(v.balance), tonToken?.symbol ?? '');
      const balanceInCurrency = formatCurrency(
        toBig(v.balance).mul(tonToken?.price ?? 0).round(tonToken?.decimals),
        shortBaseSymbol,
      );

      const accountTokens = [tonBalance];

      return {
        address: v.address,
        version: v.version,
        totalBalance: balanceInCurrency,
        tokens: accountTokens,
      } satisfies Wallet;
    }) ?? [];
  }, [shortBaseSymbol, tonToken, versions]);

  const {
    transitionClassNames: telegramLinkClassNames,
    shouldRender: isTelegramLinkRendered,
  } = useShowTransition(isTonMagicEnabled);

  const {
    handleScroll: handleContentScroll,
    isScrolled,
  } = useScrolledState();

  const handleSlideAnimationStop = useLastCallback(() => {
    if (prevRenderingKeyRef.current === SettingsState.NativeBiometricsTurnOn) {
      clearIsPinAccepted();
    }
  });

  const handleCloseSettings = useLastCallback(() => {
    closeSettings(undefined, { forceOnHeavyAnimation: true });
  });

  useHistoryBack({
    isActive: !isInsideModal && isInitialScreen,
    onBack: handleCloseSettings,
  });

  useHideBottomBar(isOpen && !isInitialScreen);

  const handleConnectedDappsOpen = useLastCallback(() => {
    getDapps();
    setSettingsState({ state: SettingsState.Dapps });
  });

  function handleAppearanceOpen() {
    setSettingsState({ state: SettingsState.Appearance });
  }

  function handlePushNotificationsOpen() {
    setSettingsState({ state: SettingsState.PushNotifications });
  }

  function handleSecurityOpen() {
    setSettingsState({ state: SettingsState.Security });
  }

  function handleAssetsOpen() {
    setSettingsState({ state: SettingsState.Assets });
  }

  function handleLanguageOpen() {
    setSettingsState({ state: SettingsState.Language });
  }

  function handleAboutOpen() {
    setSettingsState({ state: SettingsState.About });
  }

  function handleDisclaimerOpen() {
    setSettingsState({ state: SettingsState.Disclaimer });
  }

  const handleBackClick = useLastCallback(() => {
    setSettingsState({ state: SettingsState.Initial });
  });

  const handleBackClickToAssets = useLastCallback(() => {
    setSettingsState({ state: SettingsState.Assets });
  });

  const handleOpenWalletVersion = useLastCallback(() => {
    setSettingsState({ state: SettingsState.WalletVersion });
  });

  const handleDeeplinkHookToggle = useLastCallback(() => {
    toggleDeeplinkHook({ isEnabled: !isDeeplinkHookEnabled });
  });

  const handleTonProxyToggle = useLastCallback(() => {
    toggleTonProxy({ isEnabled: !isTonProxyEnabled });
  });

  const handleTonMagicToggle = useLastCallback(() => {
    toggleTonMagic({ isEnabled: !isTonMagicEnabled });
  });

  function handleClickInstallApp() {
    openUrl('https://mytonwallet.io/get', true);
  }

  function handleClickInstallOnDesktop() {
    openUrl('https://mytonwallet.io/get/desktop', true);
  }

  function handleClickInstallOnMobile() {
    openUrl('https://mytonwallet.io/get/mobile', true);
  }

  const handleAddLedgerWallet = useLastCallback(() => {
    afterSelectHardwareWallets({ hardwareSelectedIndices: [hardwareWallets![0].index] });
    handleCloseSettings();
  });

  const handleLedgerConnected = useLastCallback((isSingleWallet: boolean) => {
    if (isSingleWallet) {
      handleAddLedgerWallet();
      return;
    }
    setSettingsState({ state: SettingsState.LedgerSelectWallets });
  });

  const [isTrayIconEnabled, setIsTrayIconEnabled] = useState(false);
  useEffect(() => {
    window.electron?.getIsTrayIconEnabled().then(setIsTrayIconEnabled);
  }, []);

  const handleTrayIconEnabledToggle = useLastCallback(() => {
    setIsTrayIconEnabled(!isTrayIconEnabled);
    window.electron?.setIsTrayIconEnabled(!isTrayIconEnabled);
  });

  const [isAutoUpdateEnabled, setIsAutoUpdateEnabled] = useState(false);
  useEffect(() => {
    window.electron?.getIsAutoUpdateEnabled().then(setIsAutoUpdateEnabled);
  }, []);

  const handleAutoUpdateEnabledToggle = useLastCallback(() => {
    setIsAutoUpdateEnabled(!isAutoUpdateEnabled);
    window.electron?.setIsAutoUpdateEnabled(!isAutoUpdateEnabled);
  });

  const handleBackOrCloseAction = useLastCallback(() => {
    if (isInitialScreen) {
      if (isInsideModal) handleCloseSettings();
    } else {
      handleBackClick();
    }
  });

  const handleCloseLogOutModal = useLastCallback((shouldCloseSettings: boolean) => {
    closeLogOutModal();
    if (shouldCloseSettings) {
      handleCloseSettings();
    }
  });

  function handleOpenHardwareModal() {
    openSettingsHardwareWallet();
  }

  const handleMultipleClick = () => {
    if (clicksAmount + 1 >= AMOUNT_OF_CLICKS_FOR_DEVELOPERS_MODE) {
      openDeveloperModal();
    } else {
      setClicksAmount(clicksAmount + 1);
    }
  };

  useEffect(
    () => captureEscKeyListener(isInsideModal ? handleBackOrCloseAction : handleBackClick),
    [isInsideModal],
  );

  useEffect(() => {
    if (!IS_TOUCH_ENV) {
      return undefined;
    }

    return captureControlledSwipe(transitionRef.current!, {
      onSwipeRightStart: IS_DELEGATED_BOTTOM_SHEET ? handleBackClick : handleBackOrCloseAction,
      onCancel: () => {
        setSettingsState({ state: prevRenderingKeyRef.current! });
      },
    });
  }, [prevRenderingKeyRef]);

  function renderHandleDeeplinkButton() {
    return (
      <div className={styles.item} onClick={handleDeeplinkHookToggle}>
        <img className={styles.menuIcon} src={tonLinksImg} alt={lang('Handle ton:// links')} />
        {lang('Handle ton:// links')}

        <Switcher
          className={styles.menuSwitcher}
          label={lang('Handle ton:// links')}
          checked={isDeeplinkHookEnabled}
        />
      </div>
    );
  }

  function renderSettings() {
    return (
      <div className={styles.slide}>
        {isInsideModal ? (
          <ModalHeader
            title={lang('Settings')}
            withNotch={isScrolled}
            onClose={!isPortrait ? handleCloseSettings : undefined}
            className={styles.modalHeader}
          />
        ) : (
          <div className={buildClassName(styles.header, 'with-notch-on-scroll', isScrolled && 'is-scrolled')}>
            <Button
              isSimple
              isText
              onClick={handleCloseSettings}
              className={buildClassName(styles.headerBack, isPortrait && styles.hidden)}
            >
              <i className={buildClassName(styles.iconChevron, 'icon-chevron-left')} aria-hidden />
              <span>{lang('Back')}</span>
            </Button>
            <span className={styles.headerTitle}>{lang('Settings')}</span>
          </div>
        )}

        <div
          className={buildClassName(styles.content, 'custom-scroll', styles.withBottomSpace)}
          onScroll={handleContentScroll}
        >
          {IS_WEB && (
            <div className={styles.block}>
              <div className={styles.item} onClick={handleClickInstallApp}>
                <img className={styles.menuIcon} src={installAppImg} alt={lang('Install App')} />
                {lang('Install App')}

                <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} aria-hidden />
              </div>
            </div>
          )}
          {IS_EXTENSION && (
            <div className={styles.block}>
              {PROXY_HOSTS && (
                <div className={styles.item} onClick={handleTonProxyToggle}>
                  <img className={styles.menuIcon} src={tonProxyImg} alt={lang('TON Proxy')} />
                  {lang('TON Proxy')}

                  <Switcher
                    className={styles.menuSwitcher}
                    label={lang('Toggle TON Proxy')}
                    checked={isTonProxyEnabled}
                  />
                </div>
              )}
              <div className={styles.item} onClick={handleTonMagicToggle}>
                <img className={styles.menuIcon} src={tonMagicImg} alt={lang('TON Magic')} />
                {lang('TON Magic')}

                <Switcher
                  className={styles.menuSwitcher}
                  label={lang('Toggle TON Magic')}
                  checked={isTonMagicEnabled}
                />
              </div>
              {isTelegramLinkRendered && (
                <div className={buildClassName(styles.item, telegramLinkClassNames)} onClick={handleOpenTelegramWeb}>
                  <img className={styles.menuIcon} src={telegramImg} alt={lang('Open Telegram Web')} />
                  {lang('Open Telegram Web')}

                  <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} aria-hidden />
                </div>
              )}
              {renderHandleDeeplinkButton()}
            </div>
          )}
          {IS_ELECTRON && (
            <div className={styles.block}>
              {renderHandleDeeplinkButton()}
            </div>
          )}

          <div className={styles.block}>
            <div className={styles.item} onClick={handlePushNotificationsOpen}>
              <img className={styles.menuIcon} src={notifications} alt={lang('Notifications & Sounds')} />
              {lang('Notifications & Sounds')}

              <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} aria-hidden />
            </div>
            <div className={styles.item} onClick={handleAppearanceOpen}>
              <img className={styles.menuIcon} src={appearanceImg} alt={lang('Appearance')} />
              {lang('Appearance')}

              <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} aria-hidden />
            </div>
            <div className={styles.item} onClick={handleAssetsOpen}>
              <img className={styles.menuIcon} src={assetsActivityImg} alt={lang('Assets & Activity')} />
              {lang('Assets & Activity')}

              <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} aria-hidden />
            </div>
            {!isHardwareAccount && (
              <div className={styles.item} onClick={handleSecurityOpen}>
                <img className={styles.menuIcon} src={securityImg} alt={lang('Security')} />
                {lang('Security')}

                <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} aria-hidden />
              </div>
            )}
            {IS_DAPP_SUPPORTED && (
              <div className={styles.item} onClick={handleConnectedDappsOpen}>
                <img className={styles.menuIcon} src={connectedDappsImg} alt={lang('Connected Dapps')} />
                {lang('Connected Dapps')}

                <div className={styles.itemInfo}>
                  {dapps.length ? dapps.length : ''}
                  <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} aria-hidden />
                </div>
              </div>
            )}
            <div className={styles.item} onClick={handleLanguageOpen}>
              <img className={styles.menuIcon} src={languageImg} alt={lang('Language')} />
              {lang('Language')}
              <div className={styles.itemInfo}>
                {activeLang?.name}
                <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} aria-hidden />
              </div>
            </div>
          </div>

          <div className={styles.block}>
            {!!versions?.length && (
              <div className={styles.item} onClick={handleOpenWalletVersion}>
                <img className={styles.menuIcon} src={walletVersionImg} alt={lang('Wallet Versions')} />
                {lang('Wallet Versions')}

                <div className={styles.itemInfo}>
                  {currentVersion}
                  <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} aria-hidden />
                </div>
              </div>
            )}
            {IS_LEDGER_SUPPORTED && (
              <div className={styles.item} onClick={handleOpenHardwareModal}>
                <img className={styles.menuIcon} src={ledgerImg} alt={lang('Connect Ledger')} />
                {lang('Connect Ledger')}

                <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} aria-hidden />
              </div>
            )}
          </div>

          <div className={styles.block}>
            <div className={styles.item} onClick={handleDisclaimerOpen}>
              <img className={styles.menuIcon} src={disclaimerImg} alt={lang('Use Responsibly')} />
              {lang('Use Responsibly')}

              <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} aria-hidden />
            </div>
            {supportAccountsCount > 0 && (
              <a
                href={`https://t.me/${SUPPORT_USERNAME}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.item}
              >
                <img className={styles.menuIcon} src={supportImg} alt={lang('Get Support')} />
                {lang('Get Support')}

                <div className={styles.itemInfo}>
                  <span className={styles.small}>@{SUPPORT_USERNAME}</span>
                  <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} aria-hidden />
                </div>
              </a>
            )}
            {IS_CAPACITOR ? (
              <div className={styles.item} onClick={handleClickInstallOnDesktop}>
                <img className={styles.menuIcon} src={installDesktopImg} alt={lang('Install on Desktop')} />
                {lang('Install on Desktop')}

                <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} aria-hidden />
              </div>
            ) : IS_ELECTRON ? (
              <div className={styles.item} onClick={handleClickInstallOnMobile}>
                <img className={styles.menuIcon} src={installMobileImg} alt={lang('Install on Mobile')} />
                {lang('Install on Mobile')}

                <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} aria-hidden />
              </div>
            ) : (
              <div className={styles.item} onClick={handleClickInstallApp}>
                <img className={styles.menuIcon} src={installAppImg} alt={lang('Install App')} />
                {lang('Install App')}

                <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} aria-hidden />
              </div>
            )}
            <div className={styles.item} onClick={handleAboutOpen}>
              <img className={styles.menuIcon} src={aboutImg} alt={lang('About')} />
              {lang('About')}

              <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} aria-hidden />
            </div>
          </div>

          <div className={styles.block}>
            <a
              href={MTW_CARDS_WEBSITE}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.item}
            >
              <img className={styles.menuIcon} src={mtwCardsImg} alt={lang('MyTonWallet Cards')} />
              {lang('MyTonWallet Cards')}

              <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} aria-hidden />
            </a>
          </div>

          <div className={styles.block}>
            <div className={buildClassName(styles.item, styles.item_red)} onClick={openLogOutModal}>
              <img className={styles.menuIcon} src={exitImg} alt={lang('Exit')} />
              {lang('Exit')}

              <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} aria-hidden />
            </div>
          </div>

          <div className={styles.version} onClick={handleMultipleClick}>
            {APP_NAME} {APP_VERSION} {APP_ENV_MARKER}
          </div>
        </div>
        <SettingsDeveloperOptions
          isOpen={isDeveloperModalOpen}
          onClose={closeDeveloperModal}
          isTestnet={isTestnet}
          isCopyStorageEnabled={isCopyStorageEnabled}
        />
      </div>
    );
  }

  // eslint-disable-next-line consistent-return
  function renderContent(isActive: boolean, isFrom: boolean, currentKey: number) {
    switch (currentKey) {
      case SettingsState.Initial:
        return renderSettings();
      case SettingsState.PushNotifications:
        return (
          <SettingsPushNotifications
            isActive={isActive}
            handleBackClick={handleBackClick}
            isInsideModal={isInsideModal}
          />
        );
      case SettingsState.Appearance:
        return (
          <SettingsAppearance
            isActive={isActive}
            theme={theme}
            animationLevel={animationLevel}
            handleBackClick={handleBackClick}
            isInsideModal={isInsideModal}
            isTrayIconEnabled={isTrayIconEnabled}
            onTrayIconEnabledToggle={handleTrayIconEnabledToggle}
          />
        );
      case SettingsState.Assets:
        return (
          <SettingsAssets
            isActive={isActive}
            isInsideModal={isInsideModal}
            onBack={handleBackClick}
          />
        );
      case SettingsState.Security:
        return (
          <SettingsSecurity
            isActive={isActive}
            handleBackClick={handleBackClick}
            isInsideModal={isInsideModal}
            isAutoUpdateEnabled={isAutoUpdateEnabled}
            onAutoUpdateEnabledToggle={handleAutoUpdateEnabledToggle}
            onSettingsClose={handleCloseSettings}
          />
        );
      case SettingsState.Dapps:
        return (
          <SettingsDapps
            isActive={isActive}
            dapps={dapps}
            handleBackClick={handleBackClick}
            isInsideModal={isInsideModal}
          />
        );
      case SettingsState.Language:
        return (
          <SettingsLanguage
            isActive={isActive}
            langCode={langCode}
            handleBackClick={handleBackClick}
            isInsideModal={isInsideModal}
          />
        );
      case SettingsState.About:
        return (
          <SettingsAbout
            isActive={isActive}
            handleBackClick={handleBackClick}
            isInsideModal={isInsideModal}
            theme={theme}
          />
        );
      case SettingsState.Disclaimer:
        return (
          <SettingsDisclaimer
            isActive={isActive}
            handleBackClick={handleBackClick}
            isInsideModal={isInsideModal}
          />
        );
      case SettingsState.NativeBiometricsTurnOn:
        return (
          <SettingsNativeBiometricsTurnOn
            isActive={isActive}
            handleBackClick={handleBackClick}
          />
        );
      case SettingsState.SelectTokenList:
        return (
          <SettingsTokenList
            isActive={isActive}
            handleBackClick={handleBackClickToAssets}
          />
        );
      case SettingsState.WalletVersion:
        return (
          <SettingsWalletVersion
            currentVersion={currentVersion}
            handleBackClick={handleBackClick}
            isInsideModal={isInsideModal}
            wallets={wallets}
          />
        );
      case SettingsState.LedgerConnectHardware:
        return (
          <div className={styles.slide}>
            <LedgerConnect
              isActive={isActive}
              isStatic={!isInsideModal}
              shouldDelegateToNative={IS_DELEGATING_BOTTOM_SHEET && !isInsideModal}
              state={hardwareState}
              isLedgerConnected={isLedgerConnected}
              isTonAppConnected={isTonAppConnected}
              isRemoteTab={isRemoteTab}
              className={styles.nestedTransition}
              onBackButtonClick={handleBackClick}
              onConnected={handleLedgerConnected}
              onClose={handleBackOrCloseAction}
            />
          </div>
        );
      case SettingsState.LedgerSelectWallets:
        return (
          <div className={styles.slide}>
            <LedgerSelectWallets
              isActive={isActive}
              isStatic={!isInsideModal}
              accounts={accounts}
              hardwareWallets={hardwareWallets}
              onBackButtonClick={handleBackClick}
              onClose={handleBackOrCloseAction}
            />
          </div>
        );
      case SettingsState.HiddenNfts:
        return (
          <SettingsHiddenNfts
            isActive={isActive}
            handleBackClick={handleBackClickToAssets}
            isInsideModal={isInsideModal}
          />
        );
    }
  }

  return (
    <div className={styles.wrapper}>
      <Transition
        ref={transitionRef}
        name={resolveSlideTransitionName()}
        className={buildClassName(isInsideModal ? modalStyles.transition : styles.transitionContainer, 'custom-scroll')}
        activeKey={renderingKey}
        slideClassName={buildClassName(isInsideModal && modalStyles.transitionSlide)}
        withSwipeControl
        onStop={IS_CAPACITOR ? handleSlideAnimationStop : undefined}
      >
        {renderContent}
      </Transition>
      <LogOutModal isOpen={isLogOutModalOpened} onClose={handleCloseLogOutModal} />
      {IS_BIOMETRIC_AUTH_SUPPORTED && <Biometrics isInsideModal={isInsideModal} />}
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const isHardwareAccount = selectIsHardwareAccount(global);
  const accounts = selectNetworkAccounts(global);
  const { isCopyStorageEnabled, supportAccountsCount = 1 } = global.restrictions;

  const { currentVersion, byId: versionsById } = global.walletVersions ?? {};
  const versions = versionsById?.[global.currentAccountId!];
  const { dapps = MEMO_EMPTY_ARRAY } = selectCurrentAccountState(global) || {};
  const {
    hardwareWallets,
    hardwareState,
    isLedgerConnected,
    isTonAppConnected,
    isRemoteTab,
  } = global.hardware;

  return {
    settings: global.settings,
    dapps,
    isOpen: global.areSettingsOpen,
    tokens: selectCurrentAccountTokens(global),
    isHardwareAccount,
    currentVersion,
    versions,
    isCopyStorageEnabled,
    supportAccountsCount,
    hardwareState,
    isLedgerConnected,
    isTonAppConnected,
    isRemoteTab,
    hardwareWallets,
    accounts,
  };
})(Settings));

function handleOpenTelegramWeb() {
  window.open(TELEGRAM_WEB_URL, '_blank', 'noopener');
}

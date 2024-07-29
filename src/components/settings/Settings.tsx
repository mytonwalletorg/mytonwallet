import { AndroidSettings, IOSSettings, NativeSettings } from 'capacitor-native-settings';
import { Dialog } from 'native-dialog';
import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiWalletInfo, ApiWalletVersion } from '../../api/types';
import type { Wallet } from './SettingsWalletVersion';
import { type GlobalState, SettingsState, type UserToken } from '../../global/types';

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
  TONCOIN_SLUG,
} from '../../config';
import {
  selectAccountSettings,
  selectCurrentAccountTokens,
  selectIsHardwareAccount,
  selectIsPasswordPresent,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { getIsNativeBiometricAuthSupported } from '../../util/capacitor';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import { toBig, toDecimal } from '../../util/decimals';
import { formatCurrency, getShortCurrencySymbol } from '../../util/formatNumber';
import { openUrl } from '../../util/openUrl';
import resolveModalTransitionName from '../../util/resolveModalTransitionName';
import { captureControlledSwipe } from '../../util/swipeController';
import {
  IS_BIOMETRIC_AUTH_SUPPORTED,
  IS_DAPP_SUPPORTED,
  IS_DELEGATED_BOTTOM_SHEET,
  IS_ELECTRON,
  IS_IOS,
  IS_IOS_APP,
  IS_LEDGER_SUPPORTED,
  IS_TOUCH_ENV,
  IS_WEB,
} from '../../util/windowEnvironment';

import useEffectOnce from '../../hooks/useEffectOnce';
import useFlag from '../../hooks/useFlag';
import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useModalTransitionKeys from '../../hooks/useModalTransitionKeys';
import usePrevious2 from '../../hooks/usePrevious2';
import useScrolledState from '../../hooks/useScrolledState';
import useShowTransition from '../../hooks/useShowTransition';
import { useStateRef } from '../../hooks/useStateRef';

import LogOutModal from '../main/modals/LogOutModal';
import Button from '../ui/Button';
import ModalHeader from '../ui/ModalHeader';
import Switcher from '../ui/Switcher';
import Transition from '../ui/Transition';
import Biometrics from './biometrics/Biometrics';
import NativeBiometricsToggle from './biometrics/NativeBiometricsToggle';
import SettingsNativeBiometricsTurnOn from './biometrics/NativeBiometricsTurnOn';
import SettingsAbout from './SettingsAbout';
import SettingsAppearance from './SettingsAppearance';
import SettingsAssets from './SettingsAssets';
import SettingsDapps from './SettingsDapps';
import SettingsDeveloperOptions from './SettingsDeveloperOptions';
import SettingsDisclaimer from './SettingsDisclaimer';
import SettingsHiddenNfts from './SettingsHiddenNfts';
import SettingsLanguage from './SettingsLanguage';
import SettingsTokenList from './SettingsTokenList';
import SettingsWalletVersion from './SettingsWalletVersion';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Settings.module.scss';

import aboutImg from '../../assets/settings/settings_about.svg';
import appearanceImg from '../../assets/settings/settings_appearance.svg';
import assetsActivityImg from '../../assets/settings/settings_assets-activity.svg';
import backupSecretImg from '../../assets/settings/settings_backup-secret.svg';
import biometricsImg from '../../assets/settings/settings_biometrics.svg';
import connectedDappsImg from '../../assets/settings/settings_connected-dapps.svg';
import disclaimerImg from '../../assets/settings/settings_disclaimer.svg';
import exitImg from '../../assets/settings/settings_exit.svg';
import installAppImg from '../../assets/settings/settings_install-app.svg';
import installDesktopImg from '../../assets/settings/settings_install-desktop.svg';
import installMobileImg from '../../assets/settings/settings_install-mobile.svg';
import languageImg from '../../assets/settings/settings_language.svg';
import ledgerImg from '../../assets/settings/settings_ledger.svg';
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
  isOpen?: boolean;
  tokens?: UserToken[];
  orderedSlugs?: string[];
  isBiometricAuthEnabled: boolean;
  isPasswordPresent?: boolean;
  isHardwareAccount?: boolean;
  currentVersion?: ApiWalletVersion;
  versions?: ApiWalletInfo[];
  isCopyStorageEnabled?: boolean;
  supportAccountsCount?: number;
};

const AMOUNT_OF_CLICKS_FOR_DEVELOPERS_MODE = 5;
const SUPPORT_ACCOUNTS_COUNT_DEFAULT = 1;

function Settings({
  settings: {
    state,
    theme,
    animationLevel,
    areTinyTransfersHidden,
    isTestnet,
    isInvestorViewEnabled,
    canPlaySounds,
    langCode,
    isTonProxyEnabled,
    isTonMagicEnabled,
    isDeeplinkHookEnabled,
    areTokensWithNoCostHidden,
    isSortByValueEnabled,
    dapps,
    baseCurrency,
  },
  isOpen = false,
  tokens,
  orderedSlugs,
  isInsideModal,
  isBiometricAuthEnabled,
  isPasswordPresent,
  isHardwareAccount,
  currentVersion,
  versions,
  isCopyStorageEnabled,
  supportAccountsCount = SUPPORT_ACCOUNTS_COUNT_DEFAULT,
}: OwnProps & StateProps) {
  const {
    setSettingsState,
    openBackupWalletModal,
    openHardwareWalletModal,
    closeSettings,
    toggleDeeplinkHook,
    toggleTonProxy,
    toggleTonMagic,
    getDapps,
    initTokensOrder,
    openBiometricsTurnOn,
    openBiometricsTurnOffWarning,
    clearIsPinAccepted,
  } = getActions();

  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const transitionRef = useRef<HTMLDivElement>(null);
  const { renderingKey, nextKey } = useModalTransitionKeys(state, isOpen);
  const [clicksAmount, setClicksAmount] = useState<number>(isTestnet ? AMOUNT_OF_CLICKS_FOR_DEVELOPERS_MODE : 0);
  const prevRenderingKeyRef = useStateRef(usePrevious2(renderingKey));

  const [isDeveloperModalOpen, openDeveloperModal, closeDeveloperModal] = useFlag();
  const [isLogOutModalOpened, openLogOutModal, closeLogOutModal] = useFlag();

  const activeLang = useMemo(() => LANG_LIST.find((l) => l.langCode === langCode), [langCode]);
  const shouldRenderNativeBiometrics = isPasswordPresent && (getIsNativeBiometricAuthSupported() || IS_IOS_APP);

  const shortBaseSymbol = getShortCurrencySymbol(baseCurrency);

  const tonToken = useMemo(() => tokens?.find(({ slug }) => slug === TONCOIN_SLUG), [tokens]);

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

  useEffectOnce(() => {
    initTokensOrder();
  });

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
    isActive: !isInsideModal && renderingKey === SettingsState.Initial,
    onBack: handleCloseSettings,
  });

  const handleConnectedDappsOpen = useLastCallback(() => {
    getDapps();
    setSettingsState({ state: SettingsState.Dapps });
  });

  function handleAppearanceOpen() {
    setSettingsState({ state: SettingsState.Appearance });
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

  const handleNativeBiometricsTurnOnOpen = useLastCallback(() => {
    if (!getIsNativeBiometricAuthSupported()) {
      const warningDescription = IS_IOS
        ? 'To use this feature, first enable Face ID in your phone settings.'
        : 'To use this feature, first enable biometrics in your phone settings.';
      Dialog.confirm({
        title: lang('Warning!'),
        message: lang(warningDescription),
        okButtonTitle: lang('Open Settings'),
        cancelButtonTitle: lang('Cancel'),
      })
        .then(({ value }) => {
          if (value) {
            NativeSettings.open({
              optionAndroid: AndroidSettings.ApplicationDetails,
              optionIOS: IOSSettings.App,
            });
          }
        });
    } else {
      setSettingsState({ state: SettingsState.NativeBiometricsTurnOn });
    }
  });

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

  const handleBiometricAuthToggle = useLastCallback(() => {
    if (isBiometricAuthEnabled) {
      openBiometricsTurnOffWarning();
    } else {
      openBiometricsTurnOn();
    }
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

  function handleOpenBackupWallet() {
    if (IS_DELEGATED_BOTTOM_SHEET) {
      handleCloseSettings();
    }

    openBackupWalletModal();
  }

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
    if (renderingKey === SettingsState.Initial) {
      handleCloseSettings();
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
    openHardwareWalletModal();
  }

  const handleMultipleClick = () => {
    if (clicksAmount + 1 >= AMOUNT_OF_CLICKS_FOR_DEVELOPERS_MODE) {
      openDeveloperModal();
    } else {
      setClicksAmount(clicksAmount + 1);
    }
  };

  useEffect(
    () => captureEscKeyListener(handleBackOrCloseAction),
    [handleBackOrCloseAction],
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
  }, [handleBackClick, handleBackOrCloseAction, prevRenderingKeyRef]);

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
            onClose={handleCloseSettings}
            className={styles.modalHeader}
          />
        ) : (
          <div className={buildClassName(styles.header, 'with-notch-on-scroll', isScrolled && 'is-scrolled')}>
            <Button isSimple isText onClick={handleCloseSettings} className={styles.headerBack}>
              <i className={buildClassName(styles.iconChevron, 'icon-chevron-left')} aria-hidden />
              <span>{lang('Back')}</span>
            </Button>
            <span className={styles.headerTitle}>{lang('Settings')}</span>
          </div>
        )}

        <div
          className={buildClassName(styles.content, 'custom-scroll')}
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
          {shouldRenderNativeBiometrics && (
            <NativeBiometricsToggle
              onEnable={handleNativeBiometricsTurnOnOpen}
            />
          )}
          {isPasswordPresent && IS_BIOMETRIC_AUTH_SUPPORTED && (
            <div className={styles.block}>
              <div className={styles.item} onClick={handleBiometricAuthToggle}>
                <img className={styles.menuIcon} src={biometricsImg} alt={lang('Biometric Authentication')} />
                {lang('Biometric Authentication')}

                <Switcher
                  className={styles.menuSwitcher}
                  label={lang('Biometric Authentication')}
                  checked={isBiometricAuthEnabled}
                />
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
            {!isHardwareAccount && (
              <div className={styles.item} onClick={handleOpenBackupWallet}>
                <img className={styles.menuIcon} src={backupSecretImg} alt={lang('Back Up Secret Words')} />
                {lang('Back Up Secret Words')}

                <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} aria-hidden />
              </div>
            )}
            {!!versions?.length && !isHardwareAccount && (
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
            <div className={styles.item} onClick={handleAboutOpen}>
              <img className={styles.menuIcon} src={aboutImg} alt={lang('About')} />
              {lang('About')}

              <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} aria-hidden />
            </div>
          </div>

          {IS_CAPACITOR && (
            <div className={styles.block}>
              <div className={styles.item} onClick={handleClickInstallOnDesktop}>
                <img className={styles.menuIcon} src={installDesktopImg} alt={lang('Install on Desktop')} />
                {lang('Install on Desktop')}

                <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} aria-hidden />
              </div>
            </div>
          )}

          {IS_ELECTRON && (
            <div className={styles.block}>
              <div className={styles.item} onClick={handleClickInstallOnMobile}>
                <img className={styles.menuIcon} src={installMobileImg} alt={lang('Install on Mobile')} />
                {lang('Install on Mobile')}

                <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} aria-hidden />
              </div>
            </div>
          )}

          {IS_EXTENSION && (
            <div className={styles.block}>
              <div className={styles.item} onClick={handleClickInstallApp}>
                <img className={styles.menuIcon} src={installAppImg} alt={lang('Install App')} />
                {lang('Install App')}

                <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} aria-hidden />
              </div>
            </div>
          )}
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
      case SettingsState.Appearance:
        return (
          <SettingsAppearance
            isActive={isActive}
            theme={theme}
            animationLevel={animationLevel}
            canPlaySounds={canPlaySounds}
            handleBackClick={handleBackClick}
            isInsideModal={isInsideModal}
            isTrayIconEnabled={isTrayIconEnabled}
            onTrayIconEnabledToggle={handleTrayIconEnabledToggle}
            isAutoUpdateEnabled={isAutoUpdateEnabled}
            onAutoUpdateEnabledToggle={handleAutoUpdateEnabledToggle}
          />
        );
      case SettingsState.Assets:
        return (
          <SettingsAssets
            isActive={isActive}
            tokens={tokens}
            orderedSlugs={orderedSlugs}
            isInvestorViewEnabled={isInvestorViewEnabled}
            areTinyTransfersHidden={areTinyTransfersHidden}
            areTokensWithNoCostHidden={areTokensWithNoCostHidden}
            isSortByValueEnabled={isSortByValueEnabled}
            handleBackClick={handleBackClick}
            isInsideModal={isInsideModal}
            baseCurrency={baseCurrency}
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
        return <SettingsAbout isActive={isActive} handleBackClick={handleBackClick} isInsideModal={isInsideModal} />;
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
        name={resolveModalTransitionName()}
        className={buildClassName(isInsideModal ? modalStyles.transition : styles.transitionContainer, 'custom-scroll')}
        activeKey={renderingKey}
        nextKey={nextKey}
        slideClassName={buildClassName(modalStyles.transitionSlide, styles.transitionSlide)}
        withSwipeControl
        onStop={IS_CAPACITOR ? handleSlideAnimationStop : undefined}
      >
        {renderContent}
      </Transition>
      <LogOutModal isOpen={isLogOutModalOpened} onClose={handleCloseLogOutModal} />
      {IS_BIOMETRIC_AUTH_SUPPORTED && <Biometrics />}
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const { authConfig } = global.settings;

  const { orderedSlugs } = selectAccountSettings(global, global.currentAccountId!) ?? {};
  const isHardwareAccount = selectIsHardwareAccount(global);
  const isPasswordPresent = selectIsPasswordPresent(global);
  const { isCopyStorageEnabled, supportAccountsCount = 1 } = global.restrictions;

  const { currentVersion, byId: versionsById } = global.walletVersions ?? {};
  const versions = versionsById?.[global.currentAccountId!];

  return {
    settings: global.settings,
    isOpen: global.areSettingsOpen,
    tokens: selectCurrentAccountTokens(global),
    orderedSlugs,
    isBiometricAuthEnabled: !!authConfig && authConfig.kind !== 'password',
    isPasswordPresent,
    isHardwareAccount,
    currentVersion,
    versions,
    isCopyStorageEnabled,
    supportAccountsCount,
  };
})(Settings));

function handleOpenTelegramWeb() {
  window.open(TELEGRAM_WEB_URL, '_blank', 'noopener');
}

import React, {
  memo, useEffect, useMemo, useState,
} from '../../lib/teact/teact';

import type { ApiDapp } from '../../api/types';
import type {
  AnimationLevel, LangCode, Theme, UserToken,
} from '../../global/types';

import {
  APP_NAME,
  APP_VERSION,
  LANG_LIST,
  PROXY_HOSTS,
  TELEGRAM_WEB_URL,
} from '../../config';
import { getActions, withGlobal } from '../../global';
import {
  selectAccountSettings, selectCurrentAccountTokens, selectPopularTokensWithoutAccountTokens,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import { IS_DAPP_SUPPORTED, IS_EXTENSION, IS_LEDGER_SUPPORTED } from '../../util/windowEnvironment';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useScrolledState from '../../hooks/useScrolledState';
import useShowTransition from '../../hooks/useShowTransition';

import LogOutModal from '../main/modals/LogOutModal';
import Button from '../ui/Button';
import ModalHeader from '../ui/ModalHeader';
import Switcher from '../ui/Switcher';
import Transition from '../ui/Transition';
import SettingsAbout from './SettingsAbout';
import SettingsAppearance from './SettingsAppearance';
import SettingsAssets from './SettingsAssets';
import SettingsDapps from './SettingsDapps';
import SettingsDeveloperOptions from './SettingsDeveloperOptions';
import SettingsLanguage from './SettingsLanguage';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Settings.module.scss';

import aboutImg from '../../assets/settings/settings_about.svg';
import appearanceImg from '../../assets/settings/settings_appearance.svg';
import assetsActivityImg from '../../assets/settings/settings_assets-activity.svg';
import backupSecretImg from '../../assets/settings/settings_backup-secret.svg';
import connectedDappsImg from '../../assets/settings/settings_connected-dapps.svg';
import exitImg from '../../assets/settings/settings_exit.svg';
import languageImg from '../../assets/settings/settings_language.svg';
import ledgerImg from '../../assets/settings/settings_ledger.svg';
import telegramImg from '../../assets/settings/settings_telegram-menu.svg';
import tonLinksImg from '../../assets/settings/settings_ton-links.svg';
import tonMagicImg from '../../assets/settings/settings_ton-magic.svg';
import tonProxyImg from '../../assets/settings/settings_ton-proxy.svg';

const enum RenderingState {
  Initial,
  Appearance,
  Assets,
  Dapps,
  Language,
  About,
}

type OwnProps = {
  isInsideModal?: boolean;
};

type StateProps = {
  theme: Theme;
  animationLevel: AnimationLevel;
  areTinyTransfersHidden?: boolean;
  isInvestorViewEnabled?: boolean;
  isTestnet?: boolean;
  canPlaySounds?: boolean;
  langCode: LangCode;
  isTonProxyEnabled?: boolean;
  isTonMagicEnabled?: boolean;
  isDeeplinkHookEnabled?: boolean;
  areTokensWithNoBalanceHidden?: boolean;
  areTokensWithNoPriceHidden?: boolean;
  isSortByValueEnabled?: boolean;
  dapps: ApiDapp[];
  tokens?: UserToken[];
  popularTokens?: UserToken[];
  orderedSlugs?: string[];
};

const AMOUNT_OF_CLICKS_FOR_DEVELOPERS_MODE = 5;

function Settings({
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
  areTokensWithNoBalanceHidden,
  areTokensWithNoPriceHidden,
  isSortByValueEnabled,
  dapps,
  tokens,
  popularTokens,
  orderedSlugs,
  isInsideModal,
}: OwnProps & StateProps) {
  const {
    openBackupWalletModal,
    openHardwareWalletModal,
    closeSettings,
    toggleDeeplinkHook,
    toggleTonProxy,
    toggleTonMagic,
    getDapps,
    initTokensOrder,
  } = getActions();

  const lang = useLang();
  const [clicksAmount, setClicksAmount] = useState<number>(isTestnet ? AMOUNT_OF_CLICKS_FOR_DEVELOPERS_MODE : 0);
  const [renderingKey, setRenderingKey] = useState<number>(RenderingState.Initial);

  const [isDeveloperModalOpen, openDeveloperModal, closeDeveloperModal] = useFlag();
  const [isLogOutModalOpened, openLogOutModal, closeLogOutModal] = useFlag();

  const activeLang = useMemo(() => LANG_LIST.find((l) => l.langCode === langCode), [langCode]);

  const {
    transitionClassNames: telegramLinkClassNames,
    shouldRender: isTelegramLinkRendered,
  } = useShowTransition(isTonMagicEnabled);

  useEffect(() => {
    initTokensOrder();
  }, []);

  const {
    handleScroll: handleContentScroll,
    isAtBeginning: isContentNotScrolled,
  } = useScrolledState();

  const handleConnectedDappsOpen = useLastCallback(() => {
    getDapps();
    setRenderingKey(RenderingState.Dapps);
  });

  function handleAppearanceOpen() {
    setRenderingKey(RenderingState.Appearance);
  }

  function handleAssetsOpen() {
    setRenderingKey(RenderingState.Assets);
  }

  function handleLanguageOpen() {
    setRenderingKey(RenderingState.Language);
  }

  function handleAboutOpen() {
    setRenderingKey(RenderingState.About);
  }

  const handleBackClick = useLastCallback(() => {
    setRenderingKey(RenderingState.Initial);
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

  function handleOpenBackupWallet() {
    openBackupWalletModal();
  }

  const handleLogOut = useLastCallback(() => {
    closeLogOutModal();
    closeSettings();
  });

  const handleCloseLogOutModal = useLastCallback(() => {
    closeLogOutModal();
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
    () => captureEscKeyListener(() => {
      if (renderingKey === RenderingState.Initial) {
        closeSettings();
      } else {
        handleBackClick();
      }
    }),
    [handleBackClick, renderingKey],
  );

  function renderSettings() {
    return (
      <div className={styles.slide}>
        {isInsideModal ? (
          <ModalHeader
            title={lang('Settings')}
            withBorder={!isContentNotScrolled}
            onClose={closeSettings}
          />
        ) : (
          <div className={styles.header}>
            <Button isSimple isText onClick={closeSettings} className={styles.headerBack}>
              <i className={buildClassName(styles.iconChevron, 'icon-chevron-left')} aria-hidden />
              <span>{lang('Back')}</span>
            </Button>
            <span className={styles.headerTitle}>{lang('Settings')}</span>
          </div>
        )}

        <div className={buildClassName(styles.content, 'custom-scroll')} onScroll={handleContentScroll}>
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

                  <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} />
                </div>
              )}
              <div className={styles.item} onClick={handleDeeplinkHookToggle}>
                <img className={styles.menuIcon} src={tonLinksImg} alt={lang('Handle ton:// links')} />
                {lang('Handle ton:// links')}

                <Switcher
                  className={styles.menuSwitcher}
                  label={lang('Handle ton:// links')}
                  checked={isDeeplinkHookEnabled}
                />
              </div>
            </div>
          )}

          <div className={styles.block}>
            <div className={styles.item} onClick={handleAppearanceOpen}>
              <img className={styles.menuIcon} src={appearanceImg} alt={lang('Appearance')} />
              {lang('Appearance')}

              <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} />
            </div>
            <div className={styles.item} onClick={handleAssetsOpen}>
              <img className={styles.menuIcon} src={assetsActivityImg} alt={lang('Assets & Activity')} />
              {lang('Assets & Activity')}

              <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} />
            </div>
            {(IS_DAPP_SUPPORTED) && (
              <div className={styles.item} onClick={handleConnectedDappsOpen}>
                <img className={styles.menuIcon} src={connectedDappsImg} alt={lang('Connected Dapps')} />
                {lang('Connected Dapps')}

                <div className={styles.itemInfo}>
                  {dapps.length ? dapps.length : ''}
                  <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} />
                </div>
              </div>
            )}
            <div className={styles.item} onClick={handleLanguageOpen}>
              <img className={styles.menuIcon} src={languageImg} alt={lang('Language')} />
              {lang('Language')}
              <div className={styles.itemInfo}>
                {activeLang?.name}
                <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} />
              </div>
            </div>
          </div>

          <div className={styles.block}>
            <div className={styles.item} onClick={handleOpenBackupWallet}>
              <img className={styles.menuIcon} src={backupSecretImg} alt={lang('Back Up Secret Words')} />
              {lang('Back Up Secret Words')}

              <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} />
            </div>
            {IS_LEDGER_SUPPORTED && (
              <div className={styles.item} onClick={handleOpenHardwareModal}>
                <img className={styles.menuIcon} src={ledgerImg} alt={lang('Connect Ledger')} />
                {lang('Connect Ledger')}

                <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} />
              </div>
            )}
          </div>

          <div className={styles.block}>
            <div className={styles.item} onClick={handleAboutOpen}>
              <img className={styles.menuIcon} src={aboutImg} alt={lang('About')} />
              {lang('About')}

              <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} />
            </div>
            <div className={buildClassName(styles.item, styles.item_red)} onClick={openLogOutModal}>
              <img className={styles.menuIcon} src={exitImg} alt={lang('Exit')} />
              {lang('Exit')}

              <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} />
            </div>
          </div>

          <div className={styles.version} onClick={handleMultipleClick}>
            {APP_NAME} {APP_VERSION}
          </div>
        </div>
        <SettingsDeveloperOptions isOpen={isDeveloperModalOpen} onClose={closeDeveloperModal} isTestnet={isTestnet} />
      </div>
    );
  }

  // eslint-disable-next-line consistent-return
  function renderContent(isActive: boolean, isFrom: boolean, currentKey: number) {
    switch (currentKey) {
      case RenderingState.Initial:
        return renderSettings();
      case RenderingState.Appearance:
        return (
          <SettingsAppearance
            theme={theme}
            animationLevel={animationLevel}
            canPlaySounds={canPlaySounds}
            handleBackClick={handleBackClick}
            isInsideModal={isInsideModal}
          />
        );
      case RenderingState.Assets:
        return (
          <SettingsAssets
            tokens={tokens}
            popularTokens={popularTokens}
            orderedSlugs={orderedSlugs}
            isInvestorViewEnabled={isInvestorViewEnabled}
            areTinyTransfersHidden={areTinyTransfersHidden}
            areTokensWithNoBalanceHidden={areTokensWithNoBalanceHidden}
            areTokensWithNoPriceHidden={areTokensWithNoPriceHidden}
            isSortByValueEnabled={isSortByValueEnabled}
            handleBackClick={handleBackClick}
            isInsideModal={isInsideModal}
          />
        );
      case RenderingState.Dapps:
        return (
          <SettingsDapps
            isActive={isActive}
            dapps={dapps}
            handleBackClick={handleBackClick}
            isInsideModal={isInsideModal}
          />
        );
      case RenderingState.Language:
        return <SettingsLanguage langCode={langCode} handleBackClick={handleBackClick} isInsideModal={isInsideModal} />;
      case RenderingState.About:
        return <SettingsAbout handleBackClick={handleBackClick} isInsideModal={isInsideModal} />;
    }
  }

  return (
    <div className={styles.wrapper}>
      <Transition
        name="pushSlide"
        className={buildClassName(isInsideModal ? modalStyles.transition : styles.transitionContainer, 'custom-scroll')}
        activeKey={renderingKey}
      >
        {renderContent}
      </Transition>
      <LogOutModal isOpen={isLogOutModalOpened} onClose={handleCloseLogOutModal} onLogOut={handleLogOut} />
    </div>
  );
}

export default memo(withGlobal((global): StateProps => {
  const {
    theme,
    animationLevel,
    areTinyTransfersHidden,
    isTestnet,
    isInvestorViewEnabled,
    canPlaySounds,
    langCode,
    isTonMagicEnabled,
    isTonProxyEnabled,
    isDeeplinkHookEnabled,
    areTokensWithNoBalanceHidden,
    areTokensWithNoPriceHidden,
    isSortByValueEnabled,
    dapps,
  } = global.settings;

  const { orderedSlugs } = selectAccountSettings(global, global.currentAccountId!) ?? {};

  return {
    theme,
    animationLevel,
    areTinyTransfersHidden,
    isTestnet,
    isInvestorViewEnabled,
    canPlaySounds,
    langCode,
    isTonMagicEnabled,
    isTonProxyEnabled,
    isDeeplinkHookEnabled,
    areTokensWithNoBalanceHidden,
    areTokensWithNoPriceHidden,
    isSortByValueEnabled,
    dapps,
    tokens: selectCurrentAccountTokens(global),
    popularTokens: selectPopularTokensWithoutAccountTokens(global),
    orderedSlugs,
  };
})(Settings));

function handleOpenTelegramWeb() {
  window.open(TELEGRAM_WEB_URL, '_blank', 'noopener');
}

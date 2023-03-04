import React, {
  memo, useCallback, useEffect, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import {
  AnimationLevel, LangCode, SettingsState, Theme,
} from '../../../global/types';
import type { ApiDapp, ApiNetwork } from '../../../api/types';

import {
  ANIMATION_LEVEL_MAX, ANIMATION_LEVEL_MIN, APP_NAME, APP_VERSION, LANG_PACKS,
  TINY_TRANSFER_MAX_AMOUNT, CARD_SECONDARY_VALUE_SYMBOL, ANIMATED_STICKER_BIG_SIZE_PX,
} from '../../../config';
import { IS_TOUCH_ENV } from '../../../util/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import stopEvent from '../../../util/stopEvent';
import switchTheme from '../../../util/switchTheme';
import switchAnimationLevel from '../../../util/switchAnimationLevel';
import { setLanguage } from '../../../util/langProvider';
import useShowTransition from '../../../hooks/useShowTransition';
import useForceUpdate from '../../../hooks/useForceUpdate';
import useLang from '../../../hooks/useLang';
import useFlag from '../../../hooks/useFlag';

import Modal from '../../ui/Modal';
import Switcher from '../../ui/Switcher';
import DropDown from '../../ui/DropDown';
import Tooltip from '../../ui/Tooltip';

import styles from './SettingsModal.module.scss';
import ModalHeader from '../../ui/ModalHeader';
import Transition from '../../ui/Transition';

import modalStyles from '../../ui/Modal.module.scss';
import Button from '../../ui/Button';
import DisconnectDappModal from './DisconnectDappModal';
import AnimatedIconWithPreview from '../../ui/AnimatedIconWithPreview';
import { ANIMATED_STICKERS_PATHS } from '../../ui/helpers/animatedAssets';
import DappInfo from '../../dapps/DappInfo';

interface OwnProps {
  isOpen?: boolean;
  onClose: NoneToVoidFunction;
}

interface StateProps {
  state: SettingsState;
  theme: Theme;
  animationLevel: AnimationLevel;
  areTinyTransfersHidden?: boolean;
  isTestnet?: boolean;
  isInvestorViewEnabled?: boolean;
  canPlaySounds?: boolean;
  langCode: LangCode;
  dapps: ApiDapp[];
}

const LANGUAGE_OPTIONS = LANG_PACKS.map((langPack) => ({
  value: langPack.langCode,
  name: langPack.nativeName,
}));

const CURRENCY_OPTIONS = [{
  value: 'usd',
  name: 'US Dollar',
}];

const NETWORK_OPTIONS = [{
  value: 'mainnet',
  name: 'Mainnet',
}, {
  value: 'testnet',
  name: 'Testnet',
}];

let shouldShowDeveloperOptions = false;
const AMOUNT_OF_CLICKS_FOR_DEVELOPERS_MODE = 5;
const SWITCH_THEME_DURATION_MS = 300;

function SettingsModal({
  isOpen,
  state,
  theme,
  animationLevel,
  areTinyTransfersHidden,
  isTestnet,
  isInvestorViewEnabled,
  canPlaySounds,
  langCode,
  dapps,
  onClose,
}: OwnProps & StateProps) {
  const {
    setTheme,
    setAnimationLevel,
    toggleTinyTransfersHidden,
    toggleInvestorView,
    toggleCanPlaySounds,
    startChangingNetwork,
    changeLanguage,
    getDapps,
  } = getActions();

  const lang = useLang();
  const forceUpdate = useForceUpdate();
  const [isInvestorHelpTooltipOpen, openInvestorHelpTooltip, closeInvestorHelpTooltip] = useFlag();
  const [isTinyTransfersHelpTooltipOpen, openTinyTransfersHelpTooltip, closeTinyTransfersHelpTooltip] = useFlag();
  const [isDisconnectModalOpen, openDisconnectModal, closeDisconnectModal] = useFlag();
  const [clicksAmount, setClicksAmount] = useState<number>(isTestnet ? AMOUNT_OF_CLICKS_FOR_DEVELOPERS_MODE : 0);

  const [renderingStage, setRenderingStage] = useState<number>(state);
  const [dappToDelete, setDappToDelete] = useState<ApiDapp | undefined>();

  const THEME_OPTIONS = [{
    value: 'light',
    name: lang('Light'),
  }, {
    value: 'dark',
    name: lang('Dark'),
  }, {
    value: 'system',
    name: lang('System'),
  }];

  const {
    shouldRender: shouldRenderDeveloperOptions,
    transitionClassNames: developerOptionsTransitionClassNames,
  } = useShowTransition(shouldShowDeveloperOptions || isTestnet);

  // Initialize variable on load with testnet enabled
  useEffect(() => {
    if (isTestnet && !shouldShowDeveloperOptions) {
      shouldShowDeveloperOptions = true;
    }
  }, [isTestnet]);

  // Load all connected dapps on dapps stage
  useEffect(() => {
    if (renderingStage === SettingsState.ConnectedDapps) {
      getDapps();
    }
  }, [getDapps, renderingStage]);

  const handleThemeChange = useCallback((newTheme: string) => {
    document.documentElement.classList.add('no-transitions');
    setTheme({ theme: newTheme as Theme });
    switchTheme(newTheme as Theme);
    setTimeout(() => {
      document.documentElement.classList.remove('no-transitions');
    }, SWITCH_THEME_DURATION_MS);
  }, [setTheme]);

  const handleLanguageChange = useCallback((newLangCode: string) => {
    void setLanguage(newLangCode as LangCode, () => {
      changeLanguage({ langCode: newLangCode as LangCode });
    });
  }, [changeLanguage]);

  const handleNetworkChange = useCallback((newNetwork: string) => {
    startChangingNetwork({ network: newNetwork as ApiNetwork });
  }, [startChangingNetwork]);

  const handleAnimationLevelToggle = useCallback(() => {
    const level = animationLevel === ANIMATION_LEVEL_MIN ? ANIMATION_LEVEL_MAX : ANIMATION_LEVEL_MIN;
    setAnimationLevel({ level });
    switchAnimationLevel(level);
  }, [animationLevel, setAnimationLevel]);

  const handleCanPlaySoundToggle = useCallback(() => {
    toggleCanPlaySounds({ isEnabled: !canPlaySounds });
  }, [canPlaySounds, toggleCanPlaySounds]);

  const handleTinyTransfersHiddenToggle = useCallback(() => {
    toggleTinyTransfersHidden({ isEnabled: !areTinyTransfersHidden });
  }, [areTinyTransfersHidden, toggleTinyTransfersHidden]);

  const handleInvestorViewToggle = useCallback(() => {
    toggleInvestorView({ isEnabled: !isInvestorViewEnabled });
  }, [isInvestorViewEnabled, toggleInvestorView]);

  const handleCloseModal = useCallback(() => {
    onClose();
    setRenderingStage(SettingsState.Initial);
  }, [onClose]);

  const handleConnectedDappsOpen = useCallback(() => {
    setRenderingStage(SettingsState.ConnectedDapps);
  }, []);

  const handleBackClick = useCallback(() => {
    setRenderingStage(SettingsState.Initial);
  }, []);

  const handleDisconnectAll = useCallback(() => {
    setDappToDelete(undefined);
    openDisconnectModal();
  }, [openDisconnectModal]);

  const handleDisconnectDapp = useCallback((dapp: ApiDapp) => {
    setDappToDelete(dapp);
    openDisconnectModal();
  }, [openDisconnectModal]);

  const handleMultipleClick = () => {
    if (clicksAmount + 1 >= AMOUNT_OF_CLICKS_FOR_DEVELOPERS_MODE) {
      shouldShowDeveloperOptions = true;
      forceUpdate();
    } else {
      setClicksAmount(clicksAmount + 1);
    }
  };

  function renderSettings() {
    return (
      <>
        <ModalHeader
          title={lang('Settings')}
          onClose={handleCloseModal}
        />
        <p className={styles.blockTitle}>{lang('Appearance')}</p>
        <div className={styles.block}>
          <DropDown
            label={lang('Theme')}
            items={THEME_OPTIONS}
            selectedValue={theme}
            theme="light"
            className={styles.item}
            onChange={handleThemeChange}
          />
          <DropDown
            label={lang('Language')}
            className={styles.item}
            items={LANGUAGE_OPTIONS}
            selectedValue={langCode}
            theme="light"
            onChange={handleLanguageChange}
          />
          <div className={styles.item} onClick={handleAnimationLevelToggle}>
            {lang('Enable Animations')}

            <Switcher
              className={styles.menuSwitcher}
              label={lang('Enable Animations')}
              checked={animationLevel !== ANIMATION_LEVEL_MIN}
            />
          </div>
          <div className={styles.item} onClick={handleCanPlaySoundToggle}>
            {lang('Play Sounds')}

            <Switcher
              className={styles.menuSwitcher}
              label={lang('Play Sounds')}
              checked={canPlaySounds}
            />
          </div>
        </div>

        <p className={styles.blockTitle}>{lang('Assets and Activity')}</p>
        <div className={styles.block}>
          <DropDown
            label={lang('Fiat Currency')}
            className={styles.item}
            items={CURRENCY_OPTIONS}
            selectedValue={CURRENCY_OPTIONS[0].value}
            theme="light"
            disabled
            shouldTranslateOptions
          />
          <div className={styles.item} onClick={handleInvestorViewToggle}>
            {lang('Investor View')}

            <Tooltip
              isOpen={isInvestorHelpTooltipOpen}
              message={lang('Focus on asset value rather than current balance')}
              className={styles.tooltip}
            />
            <i
              className={buildClassName(styles.iconQuestion, 'icon-question')}
              onClick={IS_TOUCH_ENV ? stopEvent : undefined}
              onMouseEnter={openInvestorHelpTooltip}
              onMouseLeave={closeInvestorHelpTooltip}
            />
            <Switcher
              className={styles.menuSwitcher}
              label={lang('Toggle Investor View')}
              checked={isInvestorViewEnabled}
            />
          </div>
          <div className={styles.item} onClick={handleTinyTransfersHiddenToggle}>
            {lang('Hide Tiny Transfers')}

            <Tooltip
              isOpen={isTinyTransfersHelpTooltipOpen}
              message={lang('$tiny_transfers_help', [TINY_TRANSFER_MAX_AMOUNT, CARD_SECONDARY_VALUE_SYMBOL]) as string}
              className={buildClassName(styles.tooltip, styles.tooltip_wide)}
            />
            <i
              className={buildClassName(styles.iconQuestion, 'icon-question')}
              onClick={IS_TOUCH_ENV ? stopEvent : undefined}
              onMouseEnter={openTinyTransfersHelpTooltip}
              onMouseLeave={closeTinyTransfersHelpTooltip}
            />
            <Switcher
              className={styles.menuSwitcher}
              label={lang('Toggle Hide Tiny Transfers')}
              checked={areTinyTransfersHidden}
            />
          </div>
        </div>

        <div className={styles.block}>
          <div className={styles.item} onClick={handleConnectedDappsOpen}>
            {lang('Connected Dapps')}
            <i className="icon-chevron-right" />
          </div>
        </div>

        {shouldRenderDeveloperOptions && (
          <>
            <p className={styles.blockTitle}>{lang('Developer Options')}</p>
            <div className={styles.block}>
              <DropDown
                label={lang('Network')}
                className={buildClassName(styles.item, developerOptionsTransitionClassNames)}
                items={NETWORK_OPTIONS}
                selectedValue={NETWORK_OPTIONS[isTestnet ? 1 : 0].value}
                theme="light"
                menuPosition="bottom"
                onChange={handleNetworkChange}
              />
            </div>
          </>
        )}

        <div className={styles.version} onClick={!shouldShowDeveloperOptions ? handleMultipleClick : undefined}>
          {APP_NAME} {APP_VERSION}
        </div>
      </>
    );
  }

  function renderDapp(dapp: ApiDapp) {
    const { iconUrl, name, url } = dapp;
    const disconnect = () => {
      handleDisconnectDapp(dapp);
    };

    return (
      <DappInfo
        iconUrl={iconUrl}
        name={name}
        url={url}
        className={styles.dapp}
        // eslint-disable-next-line react/jsx-no-bind
        onDisconnect={disconnect}
      />
    );
  }

  function renderDapps() {
    const dappsList = dapps.map(renderDapp);

    return (
      <>
        <div>
          <Button
            className={styles.disconnectButton}
            isSimple
            onClick={handleDisconnectAll}
          >
            {lang('Disconnect All Dapps')}
          </Button>
          <p className={styles.blockDescription}>{lang('$dapps-description')}</p>
        </div>

        <p className={styles.blockTitle}>{lang('Logged in with MyTonWallet')}</p>

        <div className={styles.block}>
          { dappsList }
        </div>
      </>
    );
  }

  function renderEmptyDappsMessage(isActive: boolean) {
    return (
      <div className={styles.emptyList}>
        <AnimatedIconWithPreview
          play={isActive}
          tgsUrl={ANIMATED_STICKERS_PATHS.noData}
          previewUrl={ANIMATED_STICKERS_PATHS.noDataPreview}
          size={ANIMATED_STICKER_BIG_SIZE_PX}
          className={styles.sticker}
          noLoop={false}
          nonInteractive
        />
        <p className={styles.emptyListTitle}>{lang('No active connections')}</p>
      </div>
    );
  }

  function renderConnectedDapps(isActive: boolean) {
    const content = dapps.length === 0
      ? renderEmptyDappsMessage(isActive)
      : renderDapps();

    return (
      <>
        <ModalHeader
          title={lang('Dapps')}
          onClose={handleCloseModal}
        />

        {content}

        <div className={modalStyles.buttons}>
          <Button onClick={handleBackClick} className={modalStyles.button}>{lang('Back')}</Button>
        </div>
      </>
    );
  }

  // eslint-disable-next-line consistent-return
  function renderContent(isActive: boolean, isFrom: boolean, currentKey: number) {
    switch (currentKey) {
      case SettingsState.Initial:
        return renderSettings();
      case SettingsState.ConnectedDapps:
        return renderConnectedDapps(isActive);
    }
  }

  return (
    <>
      <Modal
        hasCloseButton
        isSlideUp
        isOpen={isOpen}
        onClose={handleCloseModal}
        dialogClassName={styles.modal}
        contentClassName={styles.content}
      >
        <Transition
          name="push-slide"
          className={buildClassName(modalStyles.transition, 'custom-scroll')}
          slideClassName={modalStyles.transitionSlide}
          activeKey={renderingStage}
        >
          {renderContent}
        </Transition>
      </Modal>
      <DisconnectDappModal isOpen={isDisconnectModalOpen} onClose={closeDisconnectModal} dapp={dappToDelete} />
    </>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const {
    state,
    theme,
    animationLevel,
    areTinyTransfersHidden,
    isTestnet,
    isInvestorViewEnabled,
    canPlaySounds,
    langCode,
    dapps,
  } = global.settings;

  return {
    state,
    theme,
    animationLevel,
    areTinyTransfersHidden,
    isTestnet,
    isInvestorViewEnabled,
    canPlaySounds,
    langCode,
    dapps,
  };
})(SettingsModal));

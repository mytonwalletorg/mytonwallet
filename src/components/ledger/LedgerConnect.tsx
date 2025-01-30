import React, {
  memo, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { Theme } from '../../global/types';
import type { LedgerTransport } from '../../util/ledger/types';
import { HardwareConnectState } from '../../global/types';

import { IS_CAPACITOR } from '../../config';
import buildClassName from '../../util/buildClassName';
import { closeLedgerTab } from '../../util/ledger/tab';
import resolveSlideTransitionName from '../../util/resolveSlideTransitionName';
import { IS_DELEGATING_BOTTOM_SHEET, IS_IOS, IS_IOS_APP } from '../../util/windowEnvironment';

import useAppTheme from '../../hooks/useAppTheme';
import useHideBottomBar from '../../hooks/useHideBottomBar';
import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useShowTransition from '../../hooks/useShowTransition';

import Button from '../ui/Button';
import Dropdown from '../ui/Dropdown';
import Image from '../ui/Image';
import ModalHeader from '../ui/ModalHeader';
import Transition from '../ui/Transition';

import settingsStyles from '../settings/Settings.module.scss';
import modalStyles from '../ui/Modal.module.scss';
import styles from './LedgerModal.module.scss';

import ledgerDesktopSrc from '../../assets/ledger/desktop.png';
import ledgerDesktopDarkSrc from '../../assets/ledger/desktop-dark.png';
import ledgerIosSrc from '../../assets/ledger/ios.png';
import ledgerIosDarkSrc from '../../assets/ledger/ios-dark.png';
import ledgerMobileBluetoothSrc from '../../assets/ledger/mobile-bluetooth.png';
import ledgerMobileBluetoothDarkSrc from '../../assets/ledger/mobile-bluetooth-dark.png';
import ledgerMobileUsbSrc from '../../assets/ledger/mobile-usb.png';
import ledgerMobileUsbDarkSrc from '../../assets/ledger/mobile-usb-dark.png';

interface OwnProps {
  isActive: boolean;
  isStatic?: boolean;
  // All API method calls should be delegated from the main to the native copy of the app on iOS (NBS)
  shouldDelegateToNative?: boolean;
  state?: HardwareConnectState;
  isLedgerConnected?: boolean;
  isTonAppConnected?: boolean;
  isRemoteTab?: boolean;
  className?: string;
  onConnected: (isSingleWallet: boolean) => void;
  onBackButtonClick?: NoneToVoidFunction;
  onCancel?: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
}

interface StateProps {
  availableTransports?: LedgerTransport[];
  lastUsedTransport?: LedgerTransport;
  currentTheme: Theme;
}

const NEXT_SLIDE_DELAY = 500;
const TRANSPORT_NAMES: Record<LedgerTransport, string> = {
  usb: 'USB',
  bluetooth: 'Bluetooth',
};

function LedgerConnect({
  isActive,
  isStatic,
  state,
  isLedgerConnected,
  isTonAppConnected,
  isRemoteTab,
  shouldDelegateToNative,
  availableTransports,
  lastUsedTransport,
  currentTheme,
  className,
  onConnected,
  onBackButtonClick,
  onCancel,
  onClose,
}: OwnProps & StateProps) {
  const {
    connectHardwareWallet,
    resetHardwareWalletConnect,
    initializeHardwareWalletModal,
    initializeHardwareWalletConnection,
  } = getActions();

  const lang = useLang();
  const [selectedTransport, setSelectedTransport] = useState<LedgerTransport | undefined>(lastUsedTransport);
  const appTheme = useAppTheme(currentTheme);

  const isLedgerFailed = isLedgerConnected === false;
  const isTonAppFailed = isTonAppConnected === false;
  const isConnected = state === HardwareConnectState.ConnectedWithSingleWallet
    || state === HardwareConnectState.ConnectedWithSeveralWallets;
  const isConnecting = state === HardwareConnectState.Connecting || (
    state === HardwareConnectState.Connect && !isLedgerFailed && !isTonAppFailed && availableTransports?.length === 1
  );
  const isWaitingForBrowser = state === HardwareConnectState.WaitingForBrowser;
  const title = isConnected ? lang('Ledger Connected!') : lang('Connect Ledger');
  const shouldCloseOnCancel = !onCancel;

  const renderingAvailableTransports = useMemo(() => {
    return (availableTransports || []).map((transport) => ({
      value: transport,
      name: TRANSPORT_NAMES[transport],
    }));
  }, [availableTransports]);
  const {
    shouldRender: shouldRenderAvailableTransports,
    transitionClassNames: availableTransportsClassNames,
  } = useShowTransition(Boolean(renderingAvailableTransports.length > 0 && selectedTransport));

  useHistoryBack({
    isActive,
    onBack: onCancel ?? onClose,
  });

  useHideBottomBar(isActive);

  useEffect(() => {
    if (selectedTransport) return;
    if (availableTransports?.length) {
      setSelectedTransport(availableTransports?.[0]);
    } else if (IS_IOS_APP) {
      setSelectedTransport('bluetooth');
    }
  }, [availableTransports, selectedTransport]);

  useEffect(() => {
    if (isRemoteTab || !isActive || (IS_DELEGATING_BOTTOM_SHEET && !shouldDelegateToNative)) return;

    initializeHardwareWalletModal({ shouldDelegateToNative: IS_DELEGATING_BOTTOM_SHEET && shouldDelegateToNative });
  }, [isActive, isRemoteTab, shouldDelegateToNative]);

  const handleConnected = useLastCallback((isSingleWallet: boolean) => {
    if (isRemoteTab || (IS_DELEGATING_BOTTOM_SHEET && !shouldDelegateToNative)) {
      return;
    }

    setTimeout(() => {
      onConnected(isSingleWallet);

      setTimeout(() => {
        resetHardwareWalletConnect();
      }, NEXT_SLIDE_DELAY);
    }, NEXT_SLIDE_DELAY);
  });

  useEffect(() => {
    if (
      state === HardwareConnectState.ConnectedWithSingleWallet
      || state === HardwareConnectState.ConnectedWithSeveralWallets
    ) {
      handleConnected(state === HardwareConnectState.ConnectedWithSingleWallet);
    }
  }, [state, handleConnected]);

  const handleCloseWithBrowserTab = useLastCallback(() => {
    const closeAction = shouldCloseOnCancel ? onClose : onCancel;
    void closeLedgerTab();
    closeAction();
  });

  const handleSubmit = useLastCallback(() => {
    if (renderingAvailableTransports.length > 1) {
      initializeHardwareWalletConnection({
        transport: selectedTransport!,
        shouldDelegateToNative,
      });
    } else {
      connectHardwareWallet({ transport: availableTransports?.[0] });
    }
  });

  function renderAvailableTransports() {
    return (
      <div className={buildClassName(styles.dropdownBlock, availableTransportsClassNames)}>
        <Dropdown
          label={lang('Connection Type')}
          items={renderingAvailableTransports}
          selectedValue={selectedTransport!}
          theme="light"
          arrow="chevron"
          disabled={isConnecting}
          className={buildClassName(styles.item, styles.item_small)}
          onChange={setSelectedTransport as (value: string) => void}
        />
      </div>
    );
  }

  function renderButtons() {
    const isFailed = state === HardwareConnectState.Failed;

    if (isRemoteTab && isConnected) {
      return (
        <div className={buildClassName(styles.actionBlock, isConnected && styles.actionBlock_single)}>
          <Button
            isDisabled={isConnecting}
            className={buildClassName(styles.button, isConnected && styles.button_single)}
            onClick={onClose}
          >
            {lang('Continue')}
          </Button>
        </div>
      );
    }

    return (
      <div className={styles.actionBlock}>
        <Button
          className={styles.button}
          onClick={shouldCloseOnCancel ? onClose : onCancel}
        >
          {lang(shouldCloseOnCancel ? 'Cancel' : 'Back')}
        </Button>
        <Button
          isPrimary
          isLoading={isConnecting}
          isDisabled={isConnecting || isConnected}
          className={styles.button}
          onClick={handleSubmit}
        >
          {isFailed ? lang('Try Again') : lang('Continue')}
        </Button>
      </div>
    );
  }

  function getLedgerIconSrc() {
    const isDarkTheme = appTheme === 'dark';
    if (!IS_CAPACITOR) {
      return isDarkTheme ? ledgerDesktopDarkSrc : ledgerDesktopSrc;
    }

    if (IS_IOS) {
      return isDarkTheme ? ledgerIosDarkSrc : ledgerIosSrc;
    }

    if (selectedTransport === 'bluetooth') {
      return isDarkTheme ? ledgerMobileBluetoothDarkSrc : ledgerMobileBluetoothSrc;
    }

    return isDarkTheme ? ledgerMobileUsbDarkSrc : ledgerMobileUsbSrc;
  }

  function renderWaitingForBrowser() {
    return (
      <>
        {!isStatic ? (
          <ModalHeader
            title={title}
            onBackButtonClick={onBackButtonClick}
            onClose={!onBackButtonClick ? handleCloseWithBrowserTab : undefined}
          />
        ) : (
          <div className={settingsStyles.header}>
            <Button isSimple isText onClick={handleCloseWithBrowserTab} className={settingsStyles.headerBack}>
              <i className={buildClassName(settingsStyles.iconChevron, 'icon-chevron-left')} aria-hidden />
              <span>{lang('Back')}</span>
            </Button>
            <span className={settingsStyles.headerTitle}>{title}</span>
          </div>
        )}
        <div className={styles.container}>
          <Transition
            activeKey={!IS_CAPACITOR ? 0 : (selectedTransport !== 'bluetooth' ? 1 : 2)}
            name="semiFade"
            className={buildClassName(styles.iconBlock, IS_CAPACITOR && styles.mobile)}
            slideClassName={styles.iconBlockSlide}
          >
            <Image
              url={getLedgerIconSrc()}
              imageClassName={styles.ledgerIcon}
            />
          </Transition>
          <div
            className={buildClassName(
              styles.textBlock,
              styles.textBlock_gap,
            )}
          >
            <span className={styles.text}>
              <i className={buildClassName(styles.textIcon, 'icon-dot')} aria-hidden />
              {lang('Switch to the newly opened tab to connect Ledger.')}
            </span>
            <span className={styles.text}>
              <i className={buildClassName(styles.textIcon, 'icon-dot')} aria-hidden />
              {lang('Once connected, switch back to this window to proceed.')}
            </span>
          </div>
          <div className={buildClassName(styles.actionBlock, styles.actionBlock_single)}>
            <Button
              className={buildClassName(styles.button, styles.button_single)}
              onClick={handleCloseWithBrowserTab}
            >
              {lang(shouldCloseOnCancel ? 'Cancel' : 'Back')}
            </Button>
          </div>
        </div>
      </>
    );
  }

  function renderConnect() {
    return (
      <>
        {!isStatic ? (
          <ModalHeader
            title={title}
            onBackButtonClick={onBackButtonClick}
            onClose={!onBackButtonClick ? onClose : undefined}
          />
        ) : (
          <div className={settingsStyles.header}>
            <Button isSimple isText onClick={onClose} className={settingsStyles.headerBack}>
              <i className={buildClassName(settingsStyles.iconChevron, 'icon-chevron-left')} aria-hidden />
              <span>{lang('Back')}</span>
            </Button>
            <span className={settingsStyles.headerTitle}>{title}</span>
          </div>
        )}
        <div className={buildClassName(
          styles.container, isStatic && styles.containerStatic, isStatic && 'static-container',
        )}
        >
          <Transition
            activeKey={!IS_CAPACITOR ? 0 : (selectedTransport !== 'bluetooth' ? 1 : 2)}
            name="semiFade"
            className={buildClassName(styles.iconBlock, IS_CAPACITOR && styles.mobile)}
            slideClassName={styles.iconBlockSlide}
          >
            <Image
              url={getLedgerIconSrc()}
              imageClassName={styles.ledgerIcon}
            />
          </Transition>
          <div
            className={buildClassName(
              styles.textBlock,
              isConnected && styles.textBlock_success,
            )}
          >
            <span
              className={buildClassName(
                styles.text,
                isLedgerFailed && styles.text_failed,
                isLedgerConnected && styles.text_connected,
                isConnected && styles.text_success,
              )}
            >
              <i
                className={buildClassName(styles.textIcon, isLedgerConnected ? 'icon-accept' : 'icon-dot')}
                aria-hidden
              />
              {lang('Connect your Ledger')}
            </span>
            <span
              className={buildClassName(
                styles.text,
                isTonAppFailed && styles.text_failed,
                isTonAppConnected && styles.text_connected,
                isConnected && styles.text_success,
              )}
            >
              <i
                className={buildClassName(styles.textIcon, isTonAppConnected ? 'icon-accept' : 'icon-dot')}
                aria-hidden
              />
              {lang('Unlock it and open the TON App')}
            </span>
          </div>

          {shouldRenderAvailableTransports && renderAvailableTransports()}
          {renderButtons()}
        </div>
      </>
    );
  }

  function renderContent() {
    if (isWaitingForBrowser) {
      return renderWaitingForBrowser();
    }

    return renderConnect();
  }

  return (
    <Transition
      name={resolveSlideTransitionName()}
      className={buildClassName(modalStyles.transition, 'custom-scroll', className)}
      slideClassName={modalStyles.transitionSlide}
      activeKey={isWaitingForBrowser ? 1 : 0}
    >
      {renderContent}
    </Transition>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const { availableTransports, lastUsedTransport } = global.hardware;

  return {
    availableTransports,
    lastUsedTransport,
    currentTheme: global.settings.theme,
  };
})(LedgerConnect));

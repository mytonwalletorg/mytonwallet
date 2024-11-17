import React, {
  memo, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { Account } from '../../global/types';
import type { LedgerTransport } from '../../util/ledger/types';
import { HardwareConnectState } from '../../global/types';

import { IS_CAPACITOR } from '../../config';
import { selectAccounts } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { closeLedgerTab } from '../../util/ledger/tab';
import resolveModalTransitionName from '../../util/resolveModalTransitionName';
import { IS_DELEGATING_BOTTOM_SHEET } from '../../util/windowEnvironment';

import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useShowTransition from '../../hooks/useShowTransition';

import Button from '../ui/Button';
import Dropdown from '../ui/Dropdown';
import ModalHeader from '../ui/ModalHeader';
import Transition from '../ui/Transition';

import modalStyles from '../ui/Modal.module.scss';
import styles from './LedgerModal.module.scss';

interface OwnProps {
  isActive: boolean;
  state?: HardwareConnectState;
  isLedgerConnected?: boolean;
  isTonAppConnected?: boolean;
  isRemoteTab?: boolean;
  onConnected: (isSingleWallet: boolean) => void;
  onCancel?: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
}

interface StateProps {
  availableTransports?: LedgerTransport[];
  lastUsedTransport?: LedgerTransport;
  accounts?: Record<string, Account>;
}

const NEXT_SLIDE_DELAY = 500;
const TRANSPORT_NAMES: Record<LedgerTransport, string> = {
  usb: 'USB',
  bluetooth: 'Bluetooth',
};

function LedgerConnect({
  isActive,
  state,
  isLedgerConnected,
  isTonAppConnected,
  isRemoteTab,
  availableTransports,
  lastUsedTransport,
  accounts,
  onConnected,
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
  const hasAccounts = useMemo(() => Object.keys(accounts || {}).length > 0, [accounts]);

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

  useEffect(() => {
    if (!selectedTransport && availableTransports?.length) {
      setSelectedTransport(availableTransports[0]);
    }
  }, [availableTransports, selectedTransport]);

  useEffect(() => {
    if (isRemoteTab || !isActive || (IS_DELEGATING_BOTTOM_SHEET && hasAccounts)) return;

    initializeHardwareWalletModal();
  }, [hasAccounts, isActive, isRemoteTab]);

  const handleConnected = useLastCallback((isSingleWallet: boolean) => {
    if (isRemoteTab || (IS_DELEGATING_BOTTOM_SHEET && hasAccounts)) {
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
    closeLedgerTab();
    closeAction();
  });

  const handleSubmit = useLastCallback(() => {
    if (renderingAvailableTransports.length > 1) {
      initializeHardwareWalletConnection({ transport: selectedTransport! });
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
      <div className={buildClassName(styles.actionBlock, isConnected && styles.actionBlock_single)}>
        <Button
          isDisabled={isConnecting}
          className={buildClassName(styles.button, isConnected && styles.button_single)}
          onClick={shouldCloseOnCancel ? onClose : onCancel}
        >
          {lang(shouldCloseOnCancel ? 'Cancel' : 'Back')}
        </Button>
        {!isConnected && (
          <Button
            isPrimary
            isLoading={isConnecting}
            isDisabled={isConnecting}
            className={styles.button}
            onClick={handleSubmit}
          >
            {isFailed ? lang('Try Again') : lang('Continue')}
          </Button>
        )}
      </div>
    );
  }

  function renderWaitingForBrowser() {
    return (
      <>
        <ModalHeader title={title} onClose={handleCloseWithBrowserTab} />
        <div className={styles.container}>
          <div
            className={buildClassName(
              styles.iconBlock,
              styles.iconBlock_base,
            )}
          />
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
        <ModalHeader title={title} onClose={onClose} />
        <div className={styles.container}>
          <div
            className={buildClassName(
              styles.iconBlock,
              isConnected ? styles.iconBlock_success : styles.iconBlock_base,
            )}
          />
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
              {IS_CAPACITOR ? lang('Connect your Ledger') : lang('Connect your Ledger to PC')}
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
      name={resolveModalTransitionName()}
      className={buildClassName(modalStyles.transition, 'custom-scroll')}
      slideClassName={modalStyles.transitionSlide}
      activeKey={isWaitingForBrowser ? 1 : 0}
    >
      {renderContent}
    </Transition>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const { availableTransports, lastUsedTransport } = global.hardware;
  const accounts = selectAccounts(global);

  return {
    availableTransports,
    lastUsedTransport,
    accounts,
  };
})(LedgerConnect));

import React, {
  memo, useCallback, useEffect,
} from '../../lib/teact/teact';

import { HardwareConnectState } from '../../global/types';

import { getActions } from '../../global';
import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';

import Button from '../ui/Button';
import ModalHeader from '../ui/ModalHeader';

import styles from './LedgerModal.module.scss';

interface OwnProps {
  state?: HardwareConnectState;
  isLedgerConnected?: boolean;
  isTonAppConnected?: boolean;
  isRemoteTab?: boolean;
  onConnected: () => void;
  onClose: () => void;
}

const NEXT_SLIDE_DELAY = 500;

function LedgerConnect({
  state,
  isLedgerConnected,
  isTonAppConnected,
  isRemoteTab,
  onConnected,
  onClose,
}: OwnProps) {
  const {
    connectHardwareWallet,
    resetHardwareWalletConnect,
  } = getActions();
  const lang = useLang();

  const isLedgerFailed = isLedgerConnected === false;
  const isTonAppFailed = isTonAppConnected === false;
  const isConnected = state === HardwareConnectState.Connected;
  const title = isConnected ? lang('Ledger Connected!') : lang('Connect Ledger');

  const handleConnect = useCallback(() => {
    connectHardwareWallet();
  }, [connectHardwareWallet]);

  const handleConnected = useCallback(() => {
    if (isRemoteTab) {
      return;
    }

    setTimeout(() => {
      onConnected();

      setTimeout(() => {
        resetHardwareWalletConnect();
      }, NEXT_SLIDE_DELAY);
    }, NEXT_SLIDE_DELAY);
  }, [onConnected, resetHardwareWalletConnect, isRemoteTab]);

  useEffect(() => {
    if (state === HardwareConnectState.Connected) {
      handleConnected();
    }
  }, [state, handleConnected]);

  function renderButtons() {
    const isConnecting = state === HardwareConnectState.Connecting;
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
          onClick={onClose}
        >
          {lang('Cancel')}
        </Button>
        {!isConnected && (
          <Button
            isPrimary
            isDisabled={isConnecting}
            className={styles.button}
            onClick={handleConnect}
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
        <ModalHeader title={title} onClose={onClose} />
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
              <i className={buildClassName(styles.textIcon, 'icon-dot')} />
              {lang('Switch to the newly opened tab to connect Ledger.')}
            </span>
            <span className={styles.text}>
              <i className={buildClassName(styles.textIcon, 'icon-dot')} />
              {lang('Once connected, switch back to this window to proceed.')}
            </span>
          </div>
          <div className={buildClassName(styles.actionBlock, styles.actionBlock_single)}>
            <Button
              className={buildClassName(styles.button, styles.button_single)}
              onClick={onClose}
            >
              {lang('Cancel')}
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
              <i className={buildClassName(styles.textIcon, isLedgerConnected ? 'icon-accept' : 'icon-dot')} />
              {lang('Connect your Ledger to PC')}
            </span>
            <span
              className={buildClassName(
                styles.text,
                isTonAppFailed && styles.text_failed,
                isTonAppConnected && styles.text_connected,
                isConnected && styles.text_success,
              )}
            >
              <i className={buildClassName(styles.textIcon, isTonAppConnected ? 'icon-accept' : 'icon-dot')} />
              {lang('Unlock it and open the TON App')}
            </span>
          </div>
          {renderButtons()}
        </div>
      </>
    );
  }

  function renderContent() {
    if (state === HardwareConnectState.WaitingForBrowser) {
      return renderWaitingForBrowser();
    }

    return renderConnect();
  }

  return renderContent();
}

export default memo(LedgerConnect);

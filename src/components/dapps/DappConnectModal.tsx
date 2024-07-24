import React, {
  memo, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiTonConnectProof } from '../../api/tonConnect/types';
import type { ApiDapp, ApiDappPermissions } from '../../api/types';
import type { Account, HardwareConnectState } from '../../global/types';
import { DappConnectState } from '../../global/types';

import { selectNetworkAccounts } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import resolveModalTransitionName from '../../util/resolveModalTransitionName';
import { shortenAddress } from '../../util/shortenAddress';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useModalTransitionKeys from '../../hooks/useModalTransitionKeys';

import LedgerConfirmOperation from '../ledger/LedgerConfirmOperation';
import LedgerConnect from '../ledger/LedgerConnect';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import ModalHeader from '../ui/ModalHeader';
import Transition from '../ui/Transition';
import DappInfo from './DappInfo';
import DappPassword from './DappPassword';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Dapp.module.scss';

interface StateProps {
  state?: DappConnectState;
  hasConnectRequest: boolean;
  dapp?: ApiDapp;
  error?: string;
  requiredPermissions?: ApiDappPermissions;
  requiredProof?: ApiTonConnectProof;
  currentAccountId: string;
  accounts?: Record<string, Account>;
  hardwareState?: HardwareConnectState;
  isLedgerConnected?: boolean;
  isTonAppConnected?: boolean;
}

const HARDWARE_ACCOUNT_ADDRESS_SHIFT = 3;
const ACCOUNT_ADDRESS_SHIFT = 4;
const ACCOUNT_ADDRESS_SHIFT_END = 4;

function DappConnectModal({
  state,
  hasConnectRequest,
  dapp,
  error,
  requiredPermissions,
  requiredProof,
  accounts,
  currentAccountId,
  hardwareState,
  isLedgerConnected,
  isTonAppConnected,
}: StateProps) {
  const {
    submitDappConnectRequestConfirm,
    submitDappConnectRequestConfirmHardware,
    cancelDappConnectRequestConfirm,
    setDappConnectRequestState,
  } = getActions();

  const lang = useLang();
  const [selectedAccount, setSelectedAccount] = useState<string>(currentAccountId);
  const [isConfirmOpen, openConfirm, closeConfirm] = useFlag(false);

  const isOpen = hasConnectRequest;

  const { renderingKey, nextKey } = useModalTransitionKeys(state ?? 0, isOpen);

  const iterableAccounts = useMemo(() => Object.entries(accounts || {}), [accounts]);
  const isLoading = dapp === undefined;

  useEffect(() => {
    if (!currentAccountId) return;

    setSelectedAccount(currentAccountId);
  }, [currentAccountId]);

  const shouldRenderAccounts = useMemo(() => {
    return accounts && Object.keys(accounts).length > 1;
  }, [accounts]);
  const { iconUrl, name, url } = dapp || {};

  const handleSubmit = useLastCallback(() => {
    closeConfirm();
    const { isHardware } = accounts![selectedAccount];
    const { isPasswordRequired, isAddressRequired } = requiredPermissions || {};

    if (!requiredProof || (!isHardware && isAddressRequired && !isPasswordRequired)) {
      submitDappConnectRequestConfirm({
        accountId: selectedAccount,
      });

      cancelDappConnectRequestConfirm();
    } else if (isHardware) {
      setDappConnectRequestState({ state: DappConnectState.ConnectHardware });
    } else {
      // The confirmation window must be closed before the password screen is displayed
      requestAnimationFrame(() => {
        setDappConnectRequestState({ state: DappConnectState.Password });
      });
    }
  });

  const handlePasswordCancel = useLastCallback(() => {
    setDappConnectRequestState({ state: DappConnectState.Info });
  });

  const submitDappConnectRequestHardware = useLastCallback(() => {
    submitDappConnectRequestConfirmHardware({
      accountId: selectedAccount,
    });
  });

  const handlePasswordSubmit = useLastCallback((password: string) => {
    submitDappConnectRequestConfirm({
      accountId: selectedAccount,
      password,
    });
  });

  function renderAccount(accountId: string, address: string, title?: string, isHardware?: boolean) {
    const isActive = accountId === selectedAccount;
    const onClick = isActive || isLoading ? undefined : () => setSelectedAccount(accountId);
    const fullClassName = buildClassName(
      styles.account,
      isActive && styles.account_current,
      isLoading && styles.account_disabled,
    );

    return (
      <div
        key={accountId}
        className={fullClassName}
        aria-label={lang('Switch Account')}
        onClick={onClick}
      >
        {title && <span className={styles.accountName}>{title}</span>}
        <div className={styles.accountFooter}>
          {isHardware && <i className={buildClassName('icon-ledger', isHardware && styles.iconLedger)} aria-hidden />}
          <span className={styles.accountAddress}>
            {shortenAddress(
              address,
              isHardware ? HARDWARE_ACCOUNT_ADDRESS_SHIFT : ACCOUNT_ADDRESS_SHIFT,
              ACCOUNT_ADDRESS_SHIFT_END,
            )}
          </span>
        </div>
      </div>
    );
  }

  function renderAccounts() {
    const fullClassName = buildClassName(
      styles.accounts,
      'custom-scroll',
      iterableAccounts.length === 1 && styles.accounts_single,
      iterableAccounts.length === 2 && styles.accounts_two,
    );
    return (
      <>
        <p className={styles.label}>{lang('Select wallet to use on this dapp')}</p>
        <div className={fullClassName}>
          {iterableAccounts.map(
            ([accountId, { title, address, isHardware }]) => renderAccount(accountId, address, title, isHardware),
          )}
        </div>
      </>
    );
  }

  function renderDappInfo() {
    return (
      <>
        <ModalHeader title={lang('Connect Dapp')} onClose={cancelDappConnectRequestConfirm} />

        <div className={modalStyles.transitionContent}>
          <DappInfo
            iconUrl={iconUrl}
            name={name}
            url={url}
            className={buildClassName(styles.dapp_first, styles.dapp_push)}
          />
          {shouldRenderAccounts && renderAccounts()}

          <div className={styles.footer}>
            <Button
              isPrimary
              onClick={openConfirm}
            >
              {lang('Connect')}
            </Button>
          </div>
        </div>
      </>
    );
  }

  function renderWaitForConnection() {
    return (
      <>
        <ModalHeader title={lang('Connect Dapp')} onClose={cancelDappConnectRequestConfirm} />
        <div className={modalStyles.transitionContent}>
          <div className={buildClassName(styles.dappInfoSkeleton, styles.dapp_first)}>
            <div className={styles.dappInfoIconSkeleton} />
            <div className={styles.dappInfoTextSkeleton}>
              <div className={styles.nameSkeleton} />
              <div className={styles.descSkeleton} />
            </div>
          </div>
          <div className={styles.accountWrapperSkeleton}>
            {shouldRenderAccounts && renderAccounts()}
          </div>
        </div>
      </>
    );
  }

  function renderDappInfoWithSkeleton() {
    return (
      <Transition name="semiFade" activeKey={isLoading ? 0 : 1} slideClassName={styles.skeletonTransitionWrapper}>
        {isLoading ? renderWaitForConnection() : renderDappInfo()}
      </Transition>
    );
  }

  // eslint-disable-next-line consistent-return
  function renderContent(isActive: boolean, isFrom: boolean, currentKey: number) {
    switch (currentKey) {
      case DappConnectState.Info:
        return renderDappInfoWithSkeleton();
      case DappConnectState.Password:
        return (
          <DappPassword
            isActive={isActive}
            error={error}
            onSubmit={handlePasswordSubmit}
            onCancel={handlePasswordCancel}
            onClose={cancelDappConnectRequestConfirm}
          />
        );
      case DappConnectState.ConnectHardware:
        return (
          <LedgerConnect
            isActive={isActive}
            state={hardwareState}
            isTonAppConnected={isTonAppConnected}
            isLedgerConnected={isLedgerConnected}
            onConnected={submitDappConnectRequestHardware}
            onClose={handlePasswordCancel}
          />
        );
      case DappConnectState.ConfirmHardware:
        return (
          <LedgerConfirmOperation
            isActive={isActive}
            text={lang('Please confirm operation on your Ledger')}
            error={error}
            onTryAgain={submitDappConnectRequestHardware}
            onClose={handlePasswordCancel}
          />
        );
    }
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        dialogClassName={styles.modalDialog}
        nativeBottomSheetKey="dapp-connect"
        forceFullNative={renderingKey === DappConnectState.Password}
        onClose={cancelDappConnectRequestConfirm}
        onCloseAnimationEnd={cancelDappConnectRequestConfirm}
      >
        <Transition
          name={resolveModalTransitionName()}
          className={buildClassName(modalStyles.transition, 'custom-scroll')}
          slideClassName={modalStyles.transitionSlide}
          activeKey={renderingKey}
          nextKey={nextKey}
        >
          {renderContent}
        </Transition>
      </Modal>
      <Modal
        isOpen={isConfirmOpen}
        isCompact
        title={lang('Dapp Permissions')}
        onClose={closeConfirm}
      >
        <div className={styles.description}>
          {lang('$dapp_can_view_balance', {
            dappname: <strong>{name}</strong>,
          })}
        </div>
        <div className={styles.buttons}>
          <Button onClick={closeConfirm} className={styles.button}>{lang('Cancel')}</Button>
          <Button isPrimary onClick={handleSubmit} className={styles.button}>{lang('Connect')}</Button>
        </div>
      </Modal>
    </>
  );
}

export default memo(withGlobal((global): StateProps => {
  const accounts = selectNetworkAccounts(global);
  const hasConnectRequest = global.dappConnectRequest?.state !== undefined;

  const {
    state, dapp, error, accountId, permissions, proof,
  } = global.dappConnectRequest || {};

  const currentAccountId = accountId || global.currentAccountId!;

  const {
    hardwareState,
    isLedgerConnected,
    isTonAppConnected,
  } = global.hardware;

  return {
    state,
    hasConnectRequest,
    dapp,
    error,
    requiredPermissions: permissions,
    requiredProof: proof,
    currentAccountId,
    accounts,
    hardwareState,
    isLedgerConnected,
    isTonAppConnected,
  };
})(DappConnectModal));

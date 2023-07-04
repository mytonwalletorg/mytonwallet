import React, {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../lib/teact/teact';

import { DappConnectState } from '../../global/types';
import type { ApiTonConnectProof } from '../../api/tonConnect/types';
import type { ApiDapp, ApiDappPermissions } from '../../api/types';
import type {
  Account, AccountState, HardwareConnectState, UserToken,
} from '../../global/types';

import { TON_TOKEN_SLUG } from '../../config';
import { getActions, withGlobal } from '../../global';
import { bigStrToHuman } from '../../global/helpers';
import { selectCurrentAccountTokens, selectNetworkAccounts } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { formatCurrency } from '../../util/formatNumber';
import { shortenAddress } from '../../util/shortenAddress';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useModalTransitionKeys from '../../hooks/useModalTransitionKeys';

import LedgerConfirmOperation from '../ledger/LedgerConfirmOperation';
import LedgerConnect from '../ledger/LedgerConnect';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import ModalHeader from '../ui/ModalHeader';
import PasswordForm from '../ui/PasswordForm';
import Transition from '../ui/Transition';
import DappInfo from './DappInfo';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Dapp.module.scss';

interface StateProps {
  state?: DappConnectState;
  hasConnectRequest: boolean;
  dapp?: ApiDapp;
  error?: string;
  requiredPermissions?: ApiDappPermissions;
  requiredProof?: ApiTonConnectProof;
  tokens?: UserToken[];
  currentAccountId: string;
  accounts?: Record<string, Account>;
  accountsData?: Record<string, AccountState>;
  hardwareState?: HardwareConnectState;
  isLedgerConnected?: boolean;
  isTonAppConnected?: boolean;
}

const ACCOUNT_ADDRESS_SHIFT = 2;
const ACCOUNT_ADDRESS_SHIFT_END = 3;
const ACCOUNT_BALANCE_DECIMALS = 3;

function DappConnectModal({
  state,
  hasConnectRequest,
  dapp,
  error,
  requiredPermissions,
  requiredProof,
  accounts,
  accountsData,
  currentAccountId,
  tokens,
  hardwareState,
  isLedgerConnected,
  isTonAppConnected,
}: StateProps) {
  const {
    submitDappConnectRequestConfirm,
    submitDappConnectRequestConfirmHardware,
    clearDappConnectRequestError,
    cancelDappConnectRequestConfirm,
    setDappConnectRequestState,
  } = getActions();

  const lang = useLang();
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [isModalOpen, openModal, closeModal] = useFlag(hasConnectRequest);
  const [isConfirmOpen, openConfirm, closeConfirm] = useFlag(false);

  const { renderingKey, nextKey } = useModalTransitionKeys(state ?? 0, isModalOpen);

  useEffect(() => {
    if (hasConnectRequest) {
      openModal();
    } else {
      closeModal();
    }
  }, [closeModal, hasConnectRequest, openModal]);

  const shouldRenderAccounts = useMemo(() => {
    return accounts && Object.keys(accounts).length > 1;
  }, [accounts]);
  const tonToken = useMemo(() => tokens?.find(({ slug }) => slug === TON_TOKEN_SLUG), [tokens])!;

  const { iconUrl, name, url } = dapp || {};

  const handleClose = useCallback(() => {
    cancelDappConnectRequestConfirm();
    setSelectedAccountIds([]);
  }, [cancelDappConnectRequestConfirm]);

  const handleSubmit = useCallback(() => {
    closeConfirm();

    if (!requiredProof) {
      submitDappConnectRequestConfirm({
        additionalAccountIds: selectedAccountIds,
      });

      closeModal();
    } else if (accounts![currentAccountId].isHardware && requiredProof) {
      setDappConnectRequestState({ state: DappConnectState.ConnectHardware });
    } else if (requiredPermissions?.isPasswordRequired) {
      setDappConnectRequestState({ state: DappConnectState.Password });
    }
  }, [
    accounts, currentAccountId, closeConfirm, closeModal, requiredPermissions,
    selectedAccountIds, submitDappConnectRequestConfirm, requiredProof,
  ]);

  const handlePasswordCancel = useCallback(() => {
    setDappConnectRequestState({ state: DappConnectState.Info });
  }, []);

  const submitDappConnectRequestHardware = useCallback(() => {
    submitDappConnectRequestConfirmHardware({
      additionalAccountIds: selectedAccountIds,
    });
  }, [selectedAccountIds]);

  const handlePasswordSubmit = useCallback((password: string) => {
    submitDappConnectRequestConfirm({
      additionalAccountIds: selectedAccountIds,
      password,
    });
  }, [selectedAccountIds, submitDappConnectRequestConfirm]);

  const handleAccountToggle = useCallback((accountId: string) => {
    if (selectedAccountIds.includes(accountId)) {
      setSelectedAccountIds(selectedAccountIds.filter((id) => id !== accountId));
    } else {
      setSelectedAccountIds(selectedAccountIds.concat([accountId]));
    }
  }, [selectedAccountIds]);

  const iterableAccounts = useMemo(() => {
    return Object.entries(accounts || {});
  }, [accounts]);

  function renderAccount(accountId: string, address: string, title?: string) {
    const isActive = accountId === currentAccountId || selectedAccountIds.includes(accountId);
    const balance = accountsData?.[accountId].balances?.bySlug[tonToken.slug] || '0';
    const fullClassName = buildClassName(
      styles.account,
      isActive && styles.account_active,
      accountId === currentAccountId && styles.account_current,
    );

    return (
      <div
        className={fullClassName}
        aria-label={lang('Switch Account')}
        onClick={accountId !== currentAccountId ? () => handleAccountToggle(accountId) : undefined}
      >
        {title && <span className={styles.accountName}>{title}</span>}
        <div className={styles.accountFooter}>
          <i className={buildClassName(styles.accountCurrencyIcon, 'icon-ton')} aria-hidden />
          {formatCurrency(bigStrToHuman(balance), '', ACCOUNT_BALANCE_DECIMALS)}
          <span className={styles.accountAddress}>
            {shortenAddress(address, ACCOUNT_ADDRESS_SHIFT, ACCOUNT_ADDRESS_SHIFT_END)}
          </span>
        </div>

        <div className={buildClassName(styles.accountCheckMark, isActive && styles.accountCheckMark_active)} />
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
        <p className={styles.label}>{lang('Select wallets to use on this dapp')}</p>
        <div className={fullClassName}>
          {iterableAccounts.map(
            ([accountId, { title, address }]) => renderAccount(accountId, address, title),
          )}
        </div>
      </>
    );
  }

  function renderPasswordForm(isActive: boolean) {
    return (
      <>
        <ModalHeader title={lang('Enter Password')} onClose={closeModal} />
        <PasswordForm
          isActive={isActive}
          error={error}
          placeholder={lang('Enter your password')}
          submitLabel={lang('Connect')}
          onUpdate={clearDappConnectRequestError}
          onSubmit={handlePasswordSubmit}
          cancelLabel="Cancel"
          onCancel={handlePasswordCancel}
        />
      </>
    );
  }

  function renderDappInfo() {
    return (
      <>
        <ModalHeader title={lang('Connect Dapp')} onClose={closeModal} />

        <div className={modalStyles.transitionContent}>
          <DappInfo
            iconUrl={iconUrl}
            name={name}
            url={url}
            className={buildClassName(styles.dapp_first, styles.dapp_push)}
          />
          {shouldRenderAccounts && renderAccounts()}

          <div className={styles.footer}>
            <Button onClick={openConfirm} isPrimary>{lang('Connect')}</Button>
          </div>
        </div>
      </>
    );
  }

  // eslint-disable-next-line consistent-return
  function renderContent(isActive: boolean, isFrom: boolean, currentKey: number) {
    switch (currentKey) {
      case DappConnectState.Info:
        return renderDappInfo();
      case DappConnectState.Password:
        return renderPasswordForm(isActive);
      case DappConnectState.ConnectHardware:
        return (
          <LedgerConnect
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
        isOpen={isModalOpen}
        isSlideUp
        dialogClassName={styles.modalDialog}
        onClose={handleClose}
        onCloseAnimationEnd={handleClose}
      >
        <Transition
          name="pushSlide"
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
  const hasConnectRequest = Boolean(global.dappConnectRequest?.dapp);

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
    tokens: selectCurrentAccountTokens(global),
    currentAccountId,
    accounts,
    accountsData: global.byAccountId,
    hardwareState,
    isLedgerConnected,
    isTonAppConnected,
  };
})(DappConnectModal));

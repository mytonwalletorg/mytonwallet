import React, {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { Account, AccountState, UserToken } from '../../global/types';
import type { ApiDapp, ApiDappPermissions } from '../../api/types';

import { TON_TOKEN_SLUG } from '../../config';
import { bigStrToHuman } from '../../global/helpers';
import { selectCurrentAccountTokens, selectNetworkAccounts } from '../../global/selectors';
import { formatCurrency } from '../../util/formatNumber';
import buildClassName from '../../util/buildClassName';
import { shortenAddress } from '../../util/shortenAddress';
import useLang from '../../hooks/useLang';
import useFlag from '../../hooks/useFlag';

import Modal from '../ui/Modal';
import Button from '../ui/Button';
import ModalHeader from '../ui/ModalHeader';
import PasswordForm from '../ui/PasswordForm';
import Transition from '../ui/Transition';
import DappInfo from './DappInfo';

import styles from './Dapp.module.scss';
import modalStyles from '../ui/Modal.module.scss';

interface StateProps {
  hasConnectRequest: boolean;
  dapp?: ApiDapp;
  error?: string;
  requiredPermissions?: ApiDappPermissions;
  tokens?: UserToken[];
  currentAccountId: string;
  accounts?: Record<string, Account>;
  accountsData?: Record<string, AccountState>;
}

const ACCOUNT_ADDRESS_SHIFT = 2;
const ACCOUNT_ADDRESS_SHIFT_END = 3;
const ACCOUNT_BALANCE_DECIMALS = 3;

function DappConnectModal({
  hasConnectRequest,
  dapp,
  error,
  requiredPermissions,
  accounts,
  accountsData,
  currentAccountId,
  tokens,
}: StateProps) {
  const {
    submitDappConnectRequestConfirm,
    clearDappConnectRequestError,
    cancelDappConnectRequestConfirm,
  } = getActions();

  const lang = useLang();
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [isModalOpen, openModal, closeModal] = useFlag(hasConnectRequest);
  const [isConfirmOpen, openConfirm, closeConfirm] = useFlag(false);
  const [shouldRenderPassword, markRenderPassword, unmarkRenderPassword] = useFlag(false);

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
    unmarkRenderPassword();
    setSelectedAccountIds([]);
  }, [cancelDappConnectRequestConfirm, unmarkRenderPassword]);

  const handleSubmit = useCallback(() => {
    closeConfirm();

    if (requiredPermissions?.isPasswordRequired) {
      markRenderPassword();
    } else {
      submitDappConnectRequestConfirm({
        additionalAccountIds: selectedAccountIds,
      });

      closeModal();
    }
  }, [
    closeConfirm, closeModal, markRenderPassword, requiredPermissions, selectedAccountIds,
    submitDappConnectRequestConfirm,
  ]);

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

  function renderAccount(accountId: string, address: string, title?: string) {
    const isActive = accountId === currentAccountId || selectedAccountIds.includes(accountId);
    const balance = accountsData?.[accountId].balances?.bySlug[tonToken.slug] || '0';

    return (
      <div
        className={buildClassName(styles.account, isActive && styles.account_current)}
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
    return (
      <>
        <p className={styles.label}>{lang('Select wallets to use on this dapp')}</p>
        <div className={styles.accounts}>
          {Object.entries(accounts!).map(
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
          onCancel={unmarkRenderPassword}
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

  function renderContent(isActive: boolean, isFrom: boolean, currentKey: number) {
    if (currentKey === 0) {
      return renderDappInfo();
    }

    return renderPasswordForm(isActive);
  }

  return (
    <>
      <Modal
        isOpen={isModalOpen}
        isSlideUp
        dialogClassName={styles.modalDialog}
        onClose={closeModal}
        onCloseAnimationEnd={handleClose}
      >
        <Transition
          name="push-slide"
          className={buildClassName(modalStyles.transition, 'custom-scroll')}
          slideClassName={modalStyles.transitionSlide}
          activeKey={shouldRenderPassword ? 1 : 0}
          nextKey={!shouldRenderPassword ? 1 : undefined}
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
    dapp, error, accountId, permissions,
  } = global.dappConnectRequest || {};

  return {
    hasConnectRequest,
    dapp,
    error,
    requiredPermissions: permissions,
    tokens: selectCurrentAccountTokens(global),
    currentAccountId: accountId || global.currentAccountId!,
    accounts,
    accountsData: global.byAccountId,
  };
})(DappConnectModal));

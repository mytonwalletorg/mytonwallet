import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../../../lib/teact/teact';
import { withGlobal, getActions } from '../../../../global';

import { Account } from '../../../../global/types';

import { shortenAddress } from '../../../../util/shortenAddress';
import { selectNetworkAccounts } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import trapFocus from '../../../../util/trapFocus';
import captureEscKeyListener from '../../../../util/captureEscKeyListener';
import useShowTransition from '../../../../hooks/useShowTransition';
import useFlag from '../../../../hooks/useFlag';
import useFocusAfterAnimation from '../../../../hooks/useFocusAfterAnimation';
import useLang from '../../../../hooks/useLang';

import Button from '../../../ui/Button';
import AddAccountModal from '../../modals/AddAccountModal';

import styles from './AccountSelector.module.scss';

interface StateProps {
  currentAccountId: string;
  currentAccount?: Account;
  accounts?: Record<string, Account>;
}

const ACCOUNT_ADDRESS_SHIFT = 4;
const ACCOUNTS_AMOUNT_FOR_COMPACT_DIALOG = 3;

function AccountSelector({
  currentAccountId,
  currentAccount,
  accounts,
}: StateProps) {
  const { switchAccount, renameAccount, openAddAccountModal } = getActions();

  // eslint-disable-next-line no-null/no-null
  const modalRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null);

  const lang = useLang();
  const [isOpen, openAccountSelector, closeAccountSelector] = useFlag(false);
  const [isEdit, openEdit, closeEdit] = useFlag(false);
  const { shouldRender, transitionClassNames } = useShowTransition(isOpen && !isEdit);
  const [inputValue, setInputValue] = useState<string>(currentAccount?.title || '');

  const accountsAmount = useMemo(() => Object.keys(accounts || {}).length, [accounts]);

  useEffect(
    () => (shouldRender ? captureEscKeyListener(closeAccountSelector) : undefined),
    [closeAccountSelector, isOpen, shouldRender],
  );
  useEffect(
    () => (isEdit ? captureEscKeyListener(closeEdit) : undefined),
    [closeEdit, isEdit],
  );
  useEffect(() => (shouldRender && modalRef.current ? trapFocus(modalRef.current) : undefined), [shouldRender]);
  useFocusAfterAnimation({ ref: inputRef, isActive: isEdit });
  useEffect(() => {
    if (isEdit) {
      setInputValue(currentAccount?.title || '');
    }
  }, [currentAccount?.title, isEdit]);

  const handleOpenAccountSelector = useCallback(() => {
    openAccountSelector();
  }, [openAccountSelector]);

  const handleSwitchAccount = (value: string) => {
    closeAccountSelector();
    switchAccount({ accountId: value });
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    openEdit();
  };

  const handleSaveClick = useCallback(() => {
    renameAccount({ accountId: currentAccountId, title: inputValue.trim() });
    closeAccountSelector();
    closeEdit();
  }, [closeAccountSelector, closeEdit, currentAccountId, inputValue, renameAccount]);

  const handleAddWalletClick = useCallback(() => {
    closeAccountSelector();
    openAddAccountModal();
  }, [closeAccountSelector, openAddAccountModal]);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.code === 'Enter') {
      handleSaveClick();
    } else {
      setInputValue(e.currentTarget.value);
    }
  }, [handleSaveClick]);

  function renderButton(accountId: string, address: string, title?: string) {
    const isActive = accountId === currentAccountId;

    return (
      <div
        className={buildClassName(styles.button, isActive && styles.button_current)}
        aria-label={lang('Switch Account')}
        onClick={isActive ? undefined : () => handleSwitchAccount(accountId)}
      >
        {title && <span className={styles.accountName}>{title}</span>}
        <span className={styles.accountAddress}>{shortenAddress(address, ACCOUNT_ADDRESS_SHIFT)}</span>

        {isActive && (
          <div className={styles.edit} onClick={handleEditClick}>
            <i className="icon-pen" />
          </div>
        )}
      </div>
    );
  }

  const fullClassName = buildClassName(
    styles.container,
    transitionClassNames,
  );

  function renderCurrentAccount() {
    return (
      <div className={styles.addressTitle} onClick={handleOpenAccountSelector}>
        {currentAccount?.title || shortenAddress(currentAccount?.address || '')}
      </div>
    );
  }

  function renderInput() {
    return (
      <div className={styles.inputContainer}>
        <input
          ref={inputRef}
          className={styles.input}
          value={inputValue}
          onKeyDown={handleInputKeyDown}
          onChange={(e) => setInputValue(e.target.value)}
        />
        <Button isSimple className={styles.saveButton} onClick={handleSaveClick}>{lang('Done')}</Button>
      </div>
    );
  }

  function renderAccountsChooser() {
    const dialogFullClassName = buildClassName(
      styles.dialog,
      'custom-scroll',
      accountsAmount <= ACCOUNTS_AMOUNT_FOR_COMPACT_DIALOG && styles.dialog_compact,
    );

    return (
      <div
        ref={modalRef}
        className={fullClassName}
        tabIndex={-1}
        role="dialog"
      >
        <div className={styles.backdrop} onClick={() => closeAccountSelector()} />
        <div className={dialogFullClassName}>
          {accounts && Object.entries(accounts).map(
            ([accountId, { title, address }]) => renderButton(accountId, address, title),
          )}
          <Button className={styles.createAccountButton} onClick={handleAddWalletClick}>
            {lang('Add Wallet')}
            <i className={buildClassName(styles.createAccountIcon, 'icon-plus')} />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {!isEdit && renderCurrentAccount()}
      {isEdit && renderInput()}

      {shouldRender && renderAccountsChooser()}
      <AddAccountModal />
    </div>
  );
}

export default memo(withGlobal((global): StateProps => {
  const accounts = selectNetworkAccounts(global);

  return {
    currentAccountId: global.currentAccountId!,
    currentAccount: accounts?.[global.currentAccountId!],
    accounts,
  };
})(AccountSelector));

import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../../lib/teact/teact';

import type { Account } from '../../../../global/types';

import { getActions, withGlobal } from '../../../../global';
import { selectNetworkAccounts } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import captureEscKeyListener from '../../../../util/captureEscKeyListener';
import { shortenAddress } from '../../../../util/shortenAddress';
import trapFocus from '../../../../util/trapFocus';

import useFlag from '../../../../hooks/useFlag';
import useFocusAfterAnimation from '../../../../hooks/useFocusAfterAnimation';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useShowTransition from '../../../../hooks/useShowTransition';

import Button from '../../../ui/Button';
import AddAccountModal from '../../modals/AddAccountModal';

import styles from './AccountSelector.module.scss';

interface OwnProps {
  canEdit?: boolean;
  accountClassName?: string;
  menuButtonClassName?: string;
}

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
  canEdit,
  accountClassName,
  menuButtonClassName,
  accounts,
}: OwnProps & StateProps) {
  const {
    switchAccount, renameAccount, openAddAccountModal, openSettings,
  } = getActions();

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
  useFocusAfterAnimation(inputRef, !isEdit);
  useEffect(() => {
    if (isEdit) {
      setInputValue(currentAccount?.title || '');
    }
  }, [currentAccount?.title, isEdit]);

  const handleOpenAccountSelector = () => {
    openAccountSelector();
  };

  const handleSwitchAccount = (value: string) => {
    closeAccountSelector();
    switchAccount({ accountId: value });
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    openEdit();
  };

  const handleSaveClick = useLastCallback(() => {
    renameAccount({ accountId: currentAccountId, title: inputValue.trim() });
    closeAccountSelector();
    closeEdit();
  });

  const handleAddWalletClick = useLastCallback(() => {
    closeAccountSelector();
    openAddAccountModal();
  });

  const handleInputKeyDown = useLastCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.code === 'Enter') {
      handleSaveClick();
    } else {
      setInputValue(e.currentTarget.value);
    }
  });

  function renderButton(accountId: string, address: string, isHardware?: boolean, title?: string) {
    const isActive = accountId === currentAccountId;

    return (
      <div
        className={buildClassName(styles.button, isActive && styles.button_current)}
        aria-label={lang('Switch Account')}
        onClick={isActive ? undefined : () => handleSwitchAccount(accountId)}
      >
        {title && <span className={styles.accountName}>{title}</span>}
        <div className={styles.accountAddressBlock}>
          {isHardware && <i className="icon-ledger" aria-hidden />}
          <span>
            {shortenAddress(address, ACCOUNT_ADDRESS_SHIFT)}
          </span>
        </div>

        {isActive && canEdit && (
          <div className={styles.edit} onClick={handleEditClick}>
            <i className="icon-pen" aria-hidden />
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
      <>
        <div className={buildClassName(styles.addressTitle, accountClassName)} onClick={handleOpenAccountSelector}>
          {currentAccount?.title || shortenAddress(currentAccount?.address || '')}
        </div>
        <Button
          className={buildClassName(styles.menuButton, menuButtonClassName)}
          isText
          isSimple
          kind="transparent"
          ariaLabel={lang('Main menu')}
          onClick={openSettings}
        >
          <i className="icon-cog" aria-hidden />
        </Button>
      </>
    );
  }

  function renderInput() {
    return (
      <div className={buildClassName(styles.inputContainer, 'account-edit-input')}>
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
            ([accountId, { title, address, isHardware }]) => renderButton(accountId, address, isHardware, title),
          )}
          <Button className={styles.createAccountButton} onClick={handleAddWalletClick}>
            {lang('Add Wallet')}
            <i className={buildClassName(styles.createAccountIcon, 'icon-plus')} aria-hidden />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {!isEdit && renderCurrentAccount()}
      {isEdit && renderInput()}

      {shouldRender && renderAccountsChooser()}
      <AddAccountModal />
    </>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const accounts = selectNetworkAccounts(global);

  return {
    currentAccountId: global.currentAccountId!,
    currentAccount: accounts?.[global.currentAccountId!],
    accounts,
  };
})(AccountSelector));

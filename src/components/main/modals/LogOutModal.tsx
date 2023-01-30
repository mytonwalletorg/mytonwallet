import React, {
  memo, useCallback, useEffect, useLayoutEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { Account, AccountState } from '../../../global/types';

import { MNEMONIC_COUNT } from '../../../config';
import renderText from '../../../global/helpers/renderText';
import buildClassName from '../../../util/buildClassName';
import { selectCurrentAccountState, selectNetworkAccounts } from '../../../global/selectors';
import { shortenAddress } from '../../../util/shortenAddress';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';

import Checkbox from '../../ui/Checkbox';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';

import styles from './LogOutModal.module.scss';
import modalStyles from '../../ui/Modal.module.scss';

interface OwnProps {
  isOpen?: boolean;
  onClose: NoneToVoidFunction;
}

interface StateProps {
  currentAccountId: string;
  hasManyAccounts: boolean;
  accounts: Record<string, Account>;
  accountStates: Record<string, AccountState>;
  isBackupRequired?: boolean;
}

interface LinkAccount {
  id: string;
  title: string;
}

function LogOutModal({
  isOpen,
  currentAccountId,
  hasManyAccounts,
  accounts,
  accountStates,
  isBackupRequired,
  onClose,
}: OwnProps & StateProps) {
  const { signOut, switchAccount } = getActions();

  const lang = useLang();
  const [isModalOpen, openModal, closeModal] = useFlag(isOpen);
  const [isLogOutFromAllAccounts, setIsLogOutFromAllAccounts] = useState<boolean>(false);

  useLayoutEffect(() => {
    if (isOpen) {
      openModal();
    }
  }, [isOpen, openModal]);

  const accountsWithoutBackups = useMemo(() => {
    if (!hasManyAccounts) {
      return [];
    }

    return Object.entries(accounts).reduce<LinkAccount[]>((acc, [id, { title, address }]) => {
      if (id !== currentAccountId && accountStates[id].isBackupRequired) {
        acc.push({
          id,
          title: title || shortenAddress(address)!,
        });
      }

      return acc;
    }, []);
  }, [accounts, accountStates, currentAccountId, hasManyAccounts]);

  useEffect(() => {
    if (isOpen) {
      setIsLogOutFromAllAccounts(false);
    }
  }, [isOpen]);

  const handleSwitchAccount = (accountId: string) => {
    closeModal();
    switchAccount({ accountId });
  };

  const handleLogOut = useCallback(() => {
    onClose();
    signOut({ isFromAllAccounts: isLogOutFromAllAccounts });
  }, [onClose, isLogOutFromAllAccounts, signOut]);

  function renderAccountLink(account: LinkAccount, idx: number) {
    const { id, title } = account;
    const fullClassName = buildClassName(
      styles.accountLink,
      (idx + 2 === accountsWithoutBackups.length) && styles.penultimate,
    );

    return (
      <span className={fullClassName}>
        <a
          key={id}
          href="#"
          className={styles.accountLink_inner}
          onClick={(e: React.MouseEvent) => { e.preventDefault(); handleSwitchAccount(id); }}
        >
          {title}
        </a>
      </span>
    );
  }

  function renderBackupWarning() {
    return (
      <p className={modalStyles.text}>
        <b className={styles.warning}>{lang('Warning!')}</b>{' '}
        {lang('$logout_without_backup_warning')}
      </p>
    );
  }

  function renderBackupForAccountsWarning() {
    return (
      <p className={modalStyles.text}>
        <b className={styles.warning}>{lang('Warning!')}</b>{' '}
        {lang('$logout_accounts_without_backup_warning', {
          links: <>{accountsWithoutBackups.map(renderAccountLink)}</>,
        })}
      </p>
    );
  }

  const shouldRenderWarningForAnotherAccounts = isLogOutFromAllAccounts && accountsWithoutBackups.length > 0;
  const shouldRenderWarningForCurrentAccount = isBackupRequired && !shouldRenderWarningForAnotherAccounts;

  return (
    <Modal
      isOpen={isModalOpen}
      onClose={closeModal}
      onCloseAnimationEnd={onClose}
      title={lang('Log Out')}
    >
      <p className={buildClassName(modalStyles.text, modalStyles.text_noExtraMargin)}>
        {renderText(lang('$logout_warning', MNEMONIC_COUNT))}
      </p>
      {hasManyAccounts && (
        <Checkbox
          id="logount_all_accounts"
          className={styles.checkbox}
          checked={isLogOutFromAllAccounts}
          onChange={setIsLogOutFromAllAccounts}
        >
          {renderText(lang('$logout_confirm'))}
        </Checkbox>
      )}

      {shouldRenderWarningForCurrentAccount && renderBackupWarning()}
      {shouldRenderWarningForAnotherAccounts && renderBackupForAccountsWarning()}

      <div className={modalStyles.buttons}>
        <Button onClick={closeModal} className={modalStyles.button}>{lang('Cancel')}</Button>
        <Button isDestructive onClick={handleLogOut} className={modalStyles.button}>{lang('Exit')}</Button>
      </div>
    </Modal>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const accounts = selectNetworkAccounts(global) || {};
  const currentAccountState = selectCurrentAccountState(global);
  const accountIds = Object.keys(accounts);
  const hasManyAccounts = accountIds.length > 1;

  return {
    currentAccountId: global.currentAccountId!,
    hasManyAccounts,
    accounts,
    accountStates: global.byAccountId,
    isBackupRequired: currentAccountState?.isBackupRequired,
  };
})(LogOutModal));

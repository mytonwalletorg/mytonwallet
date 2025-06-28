import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiTonWalletVersion } from '../../../../api/chains/ton/types';
import type { Account, AccountSettings, AccountType } from '../../../../global/types';
import { SettingsState } from '../../../../global/types';

import { selectIsCurrentAccountViewMode, selectNetworkAccounts } from '../../../../global/selectors';
import { getAccountTitle } from '../../../../util/account';
import buildClassName from '../../../../util/buildClassName';
import captureEscKeyListener from '../../../../util/captureEscKeyListener';
import { vibrate } from '../../../../util/haptics';
import trapFocus from '../../../../util/trapFocus';

import useEffectWithPrevDeps from '../../../../hooks/useEffectWithPrevDeps';
import useFlag from '../../../../hooks/useFlag';
import useFocusAfterAnimation from '../../../../hooks/useFocusAfterAnimation';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useQrScannerSupport from '../../../../hooks/useQrScannerSupport';
import useShowTransition from '../../../../hooks/useShowTransition';

import Button from '../../../ui/Button';
import AccountButton from './AccountButton';
import CardActions from './CardActions';

import styles from './AccountSelector.module.scss';

interface OwnProps {
  canEdit?: boolean;
  forceClose?: boolean;
  accountClassName?: string;
  accountSelectorClassName?: string;
  menuButtonClassName?: string;
  noSettingsButton?: boolean;
  withAccountSelector?: boolean;
  isInsideSticky?: boolean;
}

interface StateProps {
  isViewMode: boolean;
  currentAccountId: string;
  currentAccount?: Account;
  accounts?: Record<string, Account>;
  shouldForceAccountEdit?: boolean;
  currentWalletVersion?: ApiTonWalletVersion;
  settingsByAccountId?: Record<string, AccountSettings>;
}

const ACCOUNTS_AMOUNT_FOR_COMPACT_DIALOG = 2;

function AccountSelector({
  isViewMode,
  currentAccountId,
  currentAccount,
  canEdit,
  forceClose,
  accountClassName,
  accountSelectorClassName,
  menuButtonClassName,
  noSettingsButton,
  withAccountSelector,
  accounts,
  isInsideSticky,
  shouldForceAccountEdit,
  currentWalletVersion,
  settingsByAccountId,
}: OwnProps & StateProps) {
  const {
    switchAccount,
    renameAccount,
    openAddAccountModal,
    openSettingsWithState,
  } = getActions();

  const inputRef = useRef<HTMLInputElement>();

  const lang = useLang();
  const [isOpen, openAccountSelector, closeAccountSelector] = useFlag(false);
  const [isEdit, openEdit, closeEdit] = useFlag(shouldForceAccountEdit);
  const { shouldRender, ref: containerRef } = useShowTransition({
    isOpen: isOpen && !isEdit,
    className: 'slow',
    withShouldRender: true,
  });
  const [inputValue, setInputValue] = useState<string>(currentAccount?.title || '');

  const isQrScannerSupported = useQrScannerSupport() && !isViewMode;
  const noSettingsOrQrSupported = noSettingsButton || (isInsideSticky && isQrScannerSupported);

  // The API doesn't check the TON wallet version for BIP39 and Tron-only accounts,
  // therefore `currentWalletVersion !== 'W5'` can be incorrectly true in that cases.
  const isBip39Account = currentAccount?.type === 'mnemonic' && Boolean(currentAccount?.addressByChain.tron);
  const hasTonWallet = Boolean(currentAccount?.addressByChain.ton);
  const withAddW5Button = currentWalletVersion !== 'W5' && currentAccount?.type !== 'hardware'
    && hasTonWallet && !isBip39Account;

  const accountsAmount = useMemo(() => Object.keys(accounts || {}).length, [accounts]);

  useEffect(() => {
    if (isOpen && forceClose) {
      closeAccountSelector();
    }
  }, [forceClose, isOpen]);

  useEffectWithPrevDeps(([prevShouldForceAccountEdit]) => {
    if (prevShouldForceAccountEdit && !shouldForceAccountEdit) {
      closeEdit();
    }
  }, [shouldForceAccountEdit]);

  useEffect(
    () => (shouldRender ? captureEscKeyListener(closeAccountSelector) : undefined),
    [closeAccountSelector, isOpen, shouldRender],
  );
  useEffect(
    () => (isEdit ? captureEscKeyListener(closeEdit) : undefined),
    [closeEdit, isEdit],
  );
  useEffect(
    () => (shouldRender && containerRef.current ? trapFocus(containerRef.current) : undefined),
    [containerRef, shouldRender],
  );
  useFocusAfterAnimation(inputRef, !isEdit);
  useEffect(() => {
    if (isEdit) {
      setInputValue(currentAccount?.title || '');
    }
  }, [currentAccount?.title, isEdit]);

  const handleOpenAccountSelector = () => {
    openAccountSelector();
  };

  const handleSwitchAccount = useLastCallback((accountId: string) => {
    void vibrate();
    closeAccountSelector();
    switchAccount({ accountId });
  });

  const handleSaveClick = useLastCallback(() => {
    renameAccount({ accountId: currentAccountId, title: inputValue.trim() });
    closeAccountSelector();
    closeEdit();
  });

  const handleAddWalletClick = useLastCallback(() => {
    void vibrate();
    closeAccountSelector();
    openAddAccountModal();
  });
  useEffect(() => {
    if (isEdit && isInsideSticky) {
      handleSaveClick();
    }
  }, [isEdit, isInsideSticky]);

  const handleAddV5WalletClick = useLastCallback(() => {
    void vibrate();
    closeAccountSelector();
    openSettingsWithState({ state: SettingsState.WalletVersion });
  });

  const handleInputKeyDown = useLastCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.code === 'Enter') {
      handleSaveClick();
    } else {
      setInputValue(e.currentTarget.value);
    }
  });

  function renderButton(
    accountId: string,
    addressByChain: Account['addressByChain'],
    accountType: AccountType,
    title?: string,
  ) {
    const { cardBackgroundNft } = settingsByAccountId?.[accountId] || {};
    const isActive = accountId === currentAccountId;

    return (
      <AccountButton
        key={accountId}
        accountId={accountId}
        addressByChain={addressByChain}
        accountType={accountType}
        isActive={isActive}
        title={title}
        canEditAccount={canEdit}
        cardBackgroundNft={cardBackgroundNft}
        onClick={handleSwitchAccount}
        onEdit={openEdit}
      />
    );
  }

  const fullClassName = buildClassName(
    styles.container,
    accountSelectorClassName,
  );
  const accountTitleClassName = buildClassName(
    styles.accountTitle,
    withAccountSelector && styles.accountTitleInteractive,
    accountClassName,
    isQrScannerSupported && !noSettingsOrQrSupported && styles.accountTitleShort,
  );

  function renderCurrentAccount() {
    return (
      <>
        <div className={accountTitleClassName} onClick={withAccountSelector ? handleOpenAccountSelector : undefined}>
          <span className={styles.accountTitleInner}>
            {(currentAccount && getAccountTitle(currentAccount)) ?? ''}
          </span>
          {withAccountSelector && (
            <i className={buildClassName('icon icon-caret-down', styles.arrowIcon)} aria-hidden />
          )}
        </div>
        <CardActions
          isInsideSticky={isInsideSticky}
          isQrScannerSupported={isQrScannerSupported}
          noSettingsOrQrSupported={noSettingsOrQrSupported}
          menuButtonClassName={menuButtonClassName}
          onQrScanClick={closeAccountSelector}
        />
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

  function renderAccountsSelector() {
    const dialogFullClassName = buildClassName(
      styles.dialog,
      accountsAmount <= ACCOUNTS_AMOUNT_FOR_COMPACT_DIALOG && styles.dialog_compact,
    );

    return (
      <div
        ref={containerRef}
        className={fullClassName}
        tabIndex={-1}
        role="dialog"
      >
        <div className={styles.backdrop} onClick={() => closeAccountSelector()} />
        <div className={dialogFullClassName}>
          {accounts && Object.entries(accounts).map(
            ([accountId, { title, addressByChain, type }]) => {
              return renderButton(accountId, addressByChain, type, title);
            },
          )}
          {withAddW5Button && (
            <Button className={styles.createAccountButton} onClick={handleAddV5WalletClick}>
              {lang('Switch to W5')}
              <i className={buildClassName(styles.createAccountIcon, 'icon-versions')} aria-hidden />
            </Button>
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
      {isEdit && !isInsideSticky && renderInput()}

      {shouldRender && renderAccountsSelector()}
    </>
  );
}

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const {
      shouldForceAccountEdit,
      walletVersions,
      settings: {
        byAccountId: settingsByAccountId,
      },
    } = global;

    const accounts = selectNetworkAccounts(global);
    const currentAccountId = global.currentAccountId!;
    const currentAccount = accounts?.[currentAccountId];
    const isViewMode = selectIsCurrentAccountViewMode(global);

    return {
      currentAccountId,
      currentAccount,
      accounts,
      shouldForceAccountEdit,
      currentWalletVersion: walletVersions?.currentVersion,
      settingsByAccountId,
      isViewMode,
    };
  },
  (global, _, stickToFirst) => stickToFirst(global.currentAccountId),
)(AccountSelector));

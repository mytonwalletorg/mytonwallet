import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiTonWalletVersion } from '../../../../api/chains/ton/types';
import type { Account, AccountSettings } from '../../../../global/types';
import { SettingsState } from '../../../../global/types';

import { selectNetworkAccounts } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { vibrate } from '../../../../util/capacitor';
import captureEscKeyListener from '../../../../util/captureEscKeyListener';
import { shortenAddress } from '../../../../util/shortenAddress';
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

import styles from './AccountSelector.module.scss';

interface OwnProps {
  canEdit?: boolean;
  forceClose?: boolean;
  accountClassName?: string;
  accountSelectorClassName?: string;
  menuButtonClassName?: string;
  noSettingsButton?: boolean;
  noAccountSelector?: boolean;
  isInsideSticky?: boolean;
}

interface StateProps {
  currentAccountId: string;
  currentAccount?: Account;
  accounts?: Record<string, Account>;
  shouldForceAccountEdit?: boolean;
  currentWalletVersion?: ApiTonWalletVersion;
  isAppLockEnabled?: boolean;
  settingsByAccountId?: Record<string, AccountSettings>;
}

export const HARDWARE_ACCOUNT_ADDRESS_SHIFT = 3;
export const ACCOUNT_ADDRESS_SHIFT = 4;
const ACCOUNTS_AMOUNT_FOR_COMPACT_DIALOG = 2;

function AccountSelector({
  currentAccountId,
  currentAccount,
  canEdit,
  forceClose,
  accountClassName,
  accountSelectorClassName,
  menuButtonClassName,
  noSettingsButton,
  noAccountSelector,
  accounts,
  isInsideSticky,
  shouldForceAccountEdit,
  currentWalletVersion,
  isAppLockEnabled,
  settingsByAccountId,
}: OwnProps & StateProps) {
  const {
    switchAccount,
    renameAccount,
    openAddAccountModal,
    openSettings,
    requestOpenQrScanner,
    openSettingsWithState,
    setIsManualLockActive,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const modalRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null);

  const lang = useLang();
  const [isOpen, openAccountSelector, closeAccountSelector] = useFlag(false);
  const [isEdit, openEdit, closeEdit] = useFlag(shouldForceAccountEdit);
  const { shouldRender, transitionClassNames } = useShowTransition(isOpen && !isEdit, undefined, undefined, 'slow');
  const [inputValue, setInputValue] = useState<string>(currentAccount?.title || '');

  const isQrScannerSupported = useQrScannerSupport();

  const isMultichainAccount = Boolean(currentAccount?.addressByChain.tron);
  const noSettingsOrQrSupported = noSettingsButton || (isInsideSticky && isQrScannerSupported);
  const withAddW5Button = currentWalletVersion !== 'W5' && !currentAccount?.isHardware && !isMultichainAccount;

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

  const handleSwitchAccount = useLastCallback((accountId: string) => {
    vibrate();
    closeAccountSelector();
    switchAccount({ accountId });
  });

  const handleSaveClick = useLastCallback(() => {
    renameAccount({ accountId: currentAccountId, title: inputValue.trim() });
    closeAccountSelector();
    closeEdit();
  });

  const handleAddWalletClick = useLastCallback(() => {
    vibrate();
    closeAccountSelector();
    openAddAccountModal();
  });
  useEffect(() => {
    if (isEdit && isInsideSticky) { handleSaveClick(); }
  }, [isEdit, isInsideSticky]);

  const handleAddV5WalletClick = useLastCallback(() => {
    vibrate();
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

  const handleQrScanClick = useLastCallback(() => {
    closeAccountSelector();
    requestOpenQrScanner();
  });

  const handleManualLock = useLastCallback(() => {
    setIsManualLockActive({ isActive: true, shouldHideBiometrics: true });
  });

  function renderButton(
    accountId: string,
    addressByChain: Account['addressByChain'],
    isHardware?: boolean,
    title?: string,
  ) {
    const { cardBackgroundNft } = settingsByAccountId?.[accountId] || {};
    const isActive = accountId === currentAccountId;

    return (
      <AccountButton
        key={accountId}
        accountId={accountId}
        addressByChain={addressByChain}
        isHardware={isHardware}
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
    transitionClassNames,
    accountSelectorClassName,
  );
  const accountTitleClassName = buildClassName(
    styles.accountTitle,
    accountClassName,
    isQrScannerSupported && !noSettingsOrQrSupported && styles.accountTitleShort,
  );

  function renderCurrentAccount() {
    return (
      <>
        {!noAccountSelector && (
          <div className={accountTitleClassName} onClick={handleOpenAccountSelector}>
            <span className={styles.accountTitleInner}>
              {currentAccount?.title || shortenAddress(currentAccount?.addressByChain?.ton || '')}
            </span>
            <i className={buildClassName('icon icon-caret-down', styles.arrowIcon)} aria-hidden />
          </div>
        )}
        <div className={buildClassName(styles.menuButtons, isInsideSticky && styles.inStickyCard)}>
          {isAppLockEnabled && !isInsideSticky && (
            <Button
              className={buildClassName(styles.menuButton, menuButtonClassName)}
              isText
              isSimple
              kind="transparent"
              ariaLabel={lang('App Lock')}
              onClick={handleManualLock}
            >
              <i className="icon-manual-lock" aria-hidden />
            </Button>
          )}
          {!noSettingsOrQrSupported && (
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
          )}
          {isQrScannerSupported && (
            <Button
              className={buildClassName(styles.menuButton, menuButtonClassName)}
              isText
              isSimple
              kind="transparent"
              ariaLabel={lang('Scan QR Code')}
              onClick={handleQrScanClick}
            >
              <i className="icon-qr-scanner" aria-hidden />
            </Button>
          )}
        </div>
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
            ([accountId, { title, addressByChain, isHardware }]) => {
              return renderButton(accountId, addressByChain, isHardware, title);
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

      {shouldRender && renderAccountsChooser()}
    </>
  );
}

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const accounts = selectNetworkAccounts(global);
    const currentAccountId = global.currentAccountId!;

    return {
      currentAccountId,
      currentAccount: accounts?.[currentAccountId],
      accounts,
      shouldForceAccountEdit: global.shouldForceAccountEdit,
      currentWalletVersion: global.walletVersions?.currentVersion,
      isAppLockEnabled: global.settings.isAppLockEnabled,
      settingsByAccountId: global.settings.byAccountId,
    };
  },
  (global, _, stickToFirst) => stickToFirst(global.currentAccountId),
)(AccountSelector));

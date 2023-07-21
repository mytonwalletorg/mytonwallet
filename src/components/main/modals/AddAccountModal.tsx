import React, { memo, useCallback, useState } from '../../../lib/teact/teact';

import type { Account, HardwareConnectState } from '../../../global/types';
import type { LedgerWalletInfo } from '../../../util/ledger/types';

import { ANIMATED_STICKER_BIG_SIZE_PX, MNEMONIC_COUNT } from '../../../config';
import { getActions, withGlobal } from '../../../global';
import renderText from '../../../global/helpers/renderText';
import { selectFirstNonHardwareAccount, selectNetworkAccounts } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { IS_LEDGER_SUPPORTED } from '../../../util/windowEnvironment';
import { ANIMATED_STICKERS_PATHS } from '../../ui/helpers/animatedAssets';

import useLang from '../../../hooks/useLang';

import LedgerConnect from '../../ledger/LedgerConnect';
import LedgerSelectWallets from '../../ledger/LedgerSelectWallets';
import AnimatedIconWithPreview from '../../ui/AnimatedIconWithPreview';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';
import ModalHeader from '../../ui/ModalHeader';
import PasswordForm from '../../ui/PasswordForm';
import Transition from '../../ui/Transition';

import modalStyles from '../../ui/Modal.module.scss';
import styles from './AddAccountModal.module.scss';

interface StateProps {
  isOpen?: boolean;
  isLoading?: boolean;
  error?: string;

  firstNonHardwareAccount?: Account;
  hardwareWallets?: LedgerWalletInfo[];
  accounts?: Record<string, Account>;
  hardwareState?: HardwareConnectState;
  isLedgerConnected?: boolean;
  isTonAppConnected?: boolean;
}

const enum RenderingState {
  Initial,
  Password,

  ConnectHardware,
  SelectAccountsHardware,
}

function AddAccountModal({
  isOpen,
  isLoading,
  error,
  hardwareWallets,
  firstNonHardwareAccount,
  accounts,
  hardwareState,
  isLedgerConnected,
  isTonAppConnected,
}: StateProps & StateProps) {
  const { addAccount, clearAccountError, closeAddAccountModal } = getActions();

  const lang = useLang();
  const [renderingKey, setRenderingKey] = useState<number>(RenderingState.Initial);

  const [isNewAccountImporting, setIsNewAccountImporting] = useState<boolean>(false);

  const handleBackClick = useCallback(() => {
    setRenderingKey(RenderingState.Initial);
    clearAccountError();
  }, [clearAccountError]);

  const handleModalClose = useCallback(() => {
    setRenderingKey(RenderingState.Initial);
    setIsNewAccountImporting(false);
  }, []);

  const handleNewAccountClick = useCallback(() => {
    if (!firstNonHardwareAccount) {
      addAccount({
        method: 'createAccount',
        password: '',
      });
      return;
    }

    setRenderingKey(RenderingState.Password);
    setIsNewAccountImporting(false);
  }, [firstNonHardwareAccount, addAccount]);

  const handleImportAccountClick = useCallback(() => {
    if (!firstNonHardwareAccount) {
      addAccount({
        method: 'importMnemonic',
        password: '',
      });
      return;
    }

    setRenderingKey(RenderingState.Password);
    setIsNewAccountImporting(true);
  }, [firstNonHardwareAccount, addAccount]);

  const handleImportHardwareWalletClick = useCallback(() => {
    setRenderingKey(RenderingState.ConnectHardware);
  }, []);

  const handleHardwareWalletConnected = useCallback(() => {
    setRenderingKey(RenderingState.SelectAccountsHardware);
  }, []);

  const handleSubmit = useCallback((password: string) => {
    addAccount({ method: isNewAccountImporting ? 'importMnemonic' : 'createAccount', password });
  }, [addAccount, isNewAccountImporting]);

  function renderSelector(isActive?: boolean) {
    return (
      <>
        <ModalHeader title={lang('Add Wallet')} onClose={closeAddAccountModal} />
        <AnimatedIconWithPreview
          size={ANIMATED_STICKER_BIG_SIZE_PX}
          play={isActive}
          noLoop={false}
          nonInteractive
          className={styles.sticker}
          tgsUrl={ANIMATED_STICKERS_PATHS.forge}
          previewUrl={ANIMATED_STICKERS_PATHS.forgePreview}
        />
        <p className={styles.modalText}>
          {renderText(lang('$add_account_description1'))}
        </p>
        <p className={styles.modalText}>
          {renderText(lang('$add_account_description2'))}
        </p>

        <div className={styles.modalButtons}>
          <Button
            isPrimary
            className={buildClassName(styles.button, styles.button_single)}
            onClick={handleNewAccountClick}
          >
            {lang('Create Wallet')}
          </Button>
          <span className={styles.importText}>{lang('Or import from...')}</span>
          <div className={styles.importButtons}>
            <Button
              className={styles.button}
              onClick={handleImportAccountClick}
            >
              {lang('%1$d Secret Words', MNEMONIC_COUNT)}
            </Button>
            {IS_LEDGER_SUPPORTED && (
              <Button
                className={styles.button}
                onClick={handleImportHardwareWalletClick}
              >
                {lang('Ledger')}
              </Button>
            )}
          </div>
        </div>
      </>
    );
  }

  function renderPassword(isActive: boolean) {
    return (
      <>
        <ModalHeader title={lang('Enter Password')} onClose={closeAddAccountModal} />
        <PasswordForm
          isActive={isActive}
          isLoading={isLoading}
          error={error}
          placeholder={lang('Enter your password')}
          onUpdate={clearAccountError}
          onSubmit={handleSubmit}
          submitLabel={lang('Send')}
          onCancel={handleBackClick}
          cancelLabel={lang('Back')}
        />
      </>
    );
  }

  // eslint-disable-next-line consistent-return
  function renderContent(isActive: boolean, isFrom: boolean, currentKey: number) {
    switch (currentKey) {
      case RenderingState.Initial:
        return renderSelector(isActive);
      case RenderingState.Password:
        return renderPassword(isActive);
      case RenderingState.ConnectHardware:
        return (
          <LedgerConnect
            state={hardwareState}
            isLedgerConnected={isLedgerConnected}
            isTonAppConnected={isTonAppConnected}
            onConnected={handleHardwareWalletConnected}
            onCancel={handleBackClick}
            onClose={closeAddAccountModal}
          />
        );
      case RenderingState.SelectAccountsHardware:
        return (
          <LedgerSelectWallets
            accounts={accounts}
            hardwareWallets={hardwareWallets}
            onCancel={handleBackClick}
            onClose={closeAddAccountModal}
          />
        );
    }
  }

  return (
    <Modal
      hasCloseButton
      isSlideUp
      isOpen={isOpen}
      onClose={closeAddAccountModal}
      noBackdropClose
      onCloseAnimationEnd={handleModalClose}
      dialogClassName={styles.modalDialog}
    >
      <Transition
        name="pushSlide"
        className={buildClassName(modalStyles.transition, 'custom-scroll')}
        slideClassName={modalStyles.transitionSlide}
        activeKey={renderingKey}
        nextKey={renderingKey === RenderingState.Initial ? RenderingState.Password : undefined}
      >
        {renderContent}
      </Transition>
    </Modal>
  );
}

export default memo(withGlobal((global): StateProps => {
  const accounts = selectNetworkAccounts(global);
  const firstNonHardwareAccount = selectFirstNonHardwareAccount(global);

  const {
    hardwareWallets,
    hardwareState,
    isLedgerConnected,
    isTonAppConnected,
  } = global.hardware;

  return {
    isOpen: global.isAddAccountModalOpen,
    isLoading: global.accounts?.isLoading,
    error: global.accounts?.error,

    accounts,
    firstNonHardwareAccount,
    hardwareState,
    hardwareWallets,
    isLedgerConnected,
    isTonAppConnected,
  };
})(AddAccountModal));

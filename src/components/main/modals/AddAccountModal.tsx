import React, { memo, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { LedgerWalletInfo } from '../../../util/ledger/types';
import { type Account, type HardwareConnectState, SettingsState } from '../../../global/types';

import { ANIMATED_STICKER_BIG_SIZE_PX } from '../../../config';
import renderText from '../../../global/helpers/renderText';
import { selectFirstNonHardwareAccount, selectNetworkAccounts } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import resolveSlideTransitionName from '../../../util/resolveSlideTransitionName';
import { IS_LEDGER_SUPPORTED } from '../../../util/windowEnvironment';
import { ANIMATED_STICKERS_PATHS } from '../../ui/helpers/animatedAssets';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import LedgerConnect from '../../ledger/LedgerConnect';
import LedgerSelectWallets from '../../ledger/LedgerSelectWallets';
import AnimatedIconWithPreview from '../../ui/AnimatedIconWithPreview';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';
import ModalHeader from '../../ui/ModalHeader';
import Transition from '../../ui/Transition';
import AddAccountPasswordModal from './AddAccountPasswordModal';

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
  isOtherVersionsExist?: boolean;
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
  isOtherVersionsExist,
}: StateProps) {
  const {
    addAccount,
    clearAccountError,
    closeAddAccountModal,
    afterSelectHardwareWallets,
    openSettingsWithState,
    clearAccountLoading,
  } = getActions();

  const lang = useLang();
  const [renderingKey, setRenderingKey] = useState<number>(RenderingState.Initial);

  const [isNewAccountImporting, setIsNewAccountImporting] = useState<boolean>(false);

  const handleBackClick = useLastCallback(() => {
    setRenderingKey(RenderingState.Initial);
    clearAccountError();
  });

  const handleModalClose = useLastCallback(() => {
    setRenderingKey(RenderingState.Initial);
    setIsNewAccountImporting(false);
    clearAccountLoading();
  });

  const handleNewAccountClick = useLastCallback(() => {
    if (!firstNonHardwareAccount) {
      addAccount({
        method: 'createAccount',
        password: '',
      });
      return;
    }

    setRenderingKey(RenderingState.Password);
    setIsNewAccountImporting(false);
  });

  const handleImportAccountClick = useLastCallback(() => {
    if (!firstNonHardwareAccount) {
      addAccount({
        method: 'importMnemonic',
        password: '',
      });
      return;
    }

    setRenderingKey(RenderingState.Password);
    setIsNewAccountImporting(true);
  });

  const handleImportHardwareWalletClick = useLastCallback(() => {
    setRenderingKey(RenderingState.ConnectHardware);
  });

  const handleAddLedgerWallet = useLastCallback(() => {
    afterSelectHardwareWallets({ hardwareSelectedIndices: [hardwareWallets![0].index] });
    closeAddAccountModal();
  });

  const handleHardwareWalletConnected = useLastCallback((isSingleWallet: boolean) => {
    if (isSingleWallet) {
      handleAddLedgerWallet();
      return;
    }
    setRenderingKey(RenderingState.SelectAccountsHardware);
  });

  const handleSubmit = useLastCallback((password: string) => {
    addAccount({ method: isNewAccountImporting ? 'importMnemonic' : 'createAccount', password });
  });

  const handleOpenSettingWalletVersion = useLastCallback(() => {
    closeAddAccountModal();
    openSettingsWithState({ state: SettingsState.WalletVersion });
  });

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

        <div className={styles.modalButtons}>
          <Button
            isPrimary
            className={buildClassName(styles.button, styles.button_single)}
            onClick={handleNewAccountClick}
          >
            {lang('Create Wallet')}
          </Button>
          <span className={styles.importText}>{lang('or import from')}</span>
          <div className={buildClassName(
            styles.importButtons,
            !isOtherVersionsExist && styles.importButtonsWithMargin,
          )}
          >
            <Button
              className={buildClassName(styles.button, !IS_LEDGER_SUPPORTED && styles.button_single)}
              onClick={handleImportAccountClick}
            >
              {lang('Secret Words')}
            </Button>
            {IS_LEDGER_SUPPORTED && (
              <Button
                className={buildClassName(styles.button, styles.ledgerButton)}
                onClick={handleImportHardwareWalletClick}
              >
                {lang('Ledger')}
              </Button>
            )}
          </div>
          {isOtherVersionsExist && (
            <div className={styles.walletVersionBlock}>
              <span>
                {lang('$wallet_switch_version_1', {
                  action: (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={handleOpenSettingWalletVersion}
                      className={styles.walletVersionText}
                    >
                      {lang('$wallet_switch_version_2')}
                    </div>
                  ),
                })}
              </span>
            </div>
          )}
        </div>
      </>
    );
  }

  // eslint-disable-next-line consistent-return
  function renderContent(isActive: boolean, isFrom: boolean, currentKey: number) {
    switch (currentKey) {
      case RenderingState.Initial:
        return renderSelector(isActive);
      case RenderingState.Password:
        return (
          <AddAccountPasswordModal
            isActive={isActive}
            isLoading={isLoading}
            error={error}
            onClearError={clearAccountError}
            onSubmit={handleSubmit}
            onBack={handleBackClick}
            onClose={closeAddAccountModal}
          />
        );
      case RenderingState.ConnectHardware:
        return (
          <LedgerConnect
            isActive={isActive}
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
      isOpen={isOpen}
      noBackdropClose
      dialogClassName={styles.modalDialog}
      nativeBottomSheetKey="add-account"
      forceFullNative={renderingKey === RenderingState.Password}
      onCloseAnimationEnd={handleModalClose}
      onClose={closeAddAccountModal}
    >
      <Transition
        name={resolveSlideTransitionName()}
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
  const { byId: versionById } = global.walletVersions ?? {};
  const versions = versionById?.[global.currentAccountId!];
  const isOtherVersionsExist = !!versions?.length;

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
    isOtherVersionsExist,
  };
})(AddAccountModal));

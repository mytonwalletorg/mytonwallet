import React, { memo, useEffect, useMemo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiNft } from '../../api/types';
import type { Account, GlobalState, HardwareConnectState, SavedAddress } from '../../global/types';
import { DomainLinkingState } from '../../global/types';

import { TONCOIN } from '../../config';
import {
  selectCurrentAccount,
  selectCurrentAccountState,
  selectCurrentToncoinBalance,
  selectNetworkAccounts,
  selectTonDnsLinkedAddress,
} from '../../global/selectors';
import { getDoesUsePinPad } from '../../util/biometrics';
import buildClassName from '../../util/buildClassName';
import { getLocalAddressName } from '../../util/getLocalAddressName';
import resolveSlideTransitionName from '../../util/resolveSlideTransitionName';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';

import useAddressInput from '../../hooks/useAddressInput';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useModalTransitionKeys from '../../hooks/useModalTransitionKeys';
import useSyncEffectWithPrevDeps from '../../hooks/useSyncEffectWithPrevDeps';

import TransactionBanner from '../common/TransactionBanner';
import LedgerConfirmOperation from '../ledger/LedgerConfirmOperation';
import LedgerConnect from '../ledger/LedgerConnect';
import DeleteSavedAddressModal from '../main/modals/DeleteSavedAddressModal';
import AddressBook from '../transfer/AddressBook';
import AddressInput from '../transfer/AddressInput';
import NftInfo from '../transfer/NftInfo';
import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import Button from '../ui/Button';
import FeeLine from '../ui/FeeLine';
import Modal from '../ui/Modal';
import ModalHeader from '../ui/ModalHeader';
import PasswordForm from '../ui/PasswordForm';
import Transition from '../ui/Transition';

import modalStyles from '../ui/Modal.module.scss';
import styles from './RenewDomainModal.module.scss';

interface StateProps {
  isMediaViewerOpen?: boolean;
  currentDomainLinking: GlobalState['currentDomainLinking'];
  byAddress?: Record<string, ApiNft>;
  hardwareState?: HardwareConnectState;
  isLedgerConnected?: boolean;
  isTonAppConnected?: boolean;
  tonBalance: bigint;
  savedAddresses?: SavedAddress[];
  accounts?: Record<string, Account>;
  currentTonAddress?: string;
  currentLinkedWalletAddress?: string;
}

const FULL_NATIVE_STATES = new Set([
  DomainLinkingState.Password,
  DomainLinkingState.ConnectHardware,
  DomainLinkingState.ConfirmHardware,
]);

function LinkingDomainModal({
  currentDomainLinking: {
    address,
    state,
    error,
    isLoading,
    realFee,
    walletAddress = '',
    walletAddressName = '',
    resolvedWalletAddress,
    txId,
  },
  isMediaViewerOpen,
  byAddress,
  hardwareState,
  isLedgerConnected,
  isTonAppConnected,
  tonBalance,
  accounts,
  savedAddresses,
  currentTonAddress,
  currentLinkedWalletAddress,
}: StateProps) {
  const {
    startDomainLinking,
    cancelDomainLinking,
    clearDomainLinkingError,
    submitDomainLinking,
    submitDomainLinkingHardware,
    checkDomainLinkingDraft,
    checkLinkingAddress,
    setDomainLinkingWalletAddress,
    showActivityInfo,
  } = getActions();

  const lang = useLang();

  const isOpen = state !== DomainLinkingState.None && !isMediaViewerOpen;
  const { renderingKey, nextKey } = useModalTransitionKeys(state ?? 0, isOpen);
  const domainNft = address ? byAddress?.[address] : undefined;
  const isInsufficientBalance = realFee ? tonBalance < realFee : undefined;
  const forceFullNative = FULL_NATIVE_STATES.has(renderingKey);
  const feeTerms = useMemo(() => (realFee ? { native: realFee } : undefined), [realFee]);
  const modalTitle = currentLinkedWalletAddress ? 'Change Linked Wallet' : 'Link to Wallet';

  const handleWalletAddressInput = useLastCallback((newToAddress?: string) => {
    setDomainLinkingWalletAddress({ address: newToAddress });
  });

  const {
    isAddressFocused,
    isAddressValid,
    hasAddressError,
    isQrScannerSupported,
    withPasteButton,
    addressInputRef,

    shouldUseAddressBook,
    isAddressBookOpen,
    addressBookAccountIds,
    chainForDeletion,
    addressForDeletion,

    closeAddressBook,
    handlePasteClick,
    handleAddressBlur,
    handleAddressFocus,
    handleAddressClear,
    handleQrScanClick,
    handleAddressBookItemSelect,
    handleDeleteSavedAddressClick,
    handleDeleteSavedAddressModalClose,
  } = useAddressInput({
    value: walletAddress,
    chain: 'ton',
    // It is necessary to allow linking of current wallet address to the domain, so pass an empty string
    currentAccountId: '',
    accounts,
    savedAddresses,
    validateAddress: checkLinkingAddress,
    onChange: handleWalletAddressInput,
    onClose: cancelDomainLinking,
  });

  const localAddressName = useMemo(() => getLocalAddressName({
    address: walletAddress,
    chain: 'ton',
    currentAccountId: '',
    savedAddresses,
    accounts: accounts!,
  }), [accounts, savedAddresses, walletAddress]);

  const canSubmit = isAddressValid && walletAddress !== currentLinkedWalletAddress
    && !isInsufficientBalance && !isLoading;

  useSyncEffectWithPrevDeps(([prevIsOpen]) => {
    if (!prevIsOpen && isOpen) {
      handleWalletAddressInput(walletAddress || currentLinkedWalletAddress || currentTonAddress);
    }
  }, [isOpen, currentLinkedWalletAddress, walletAddress, currentTonAddress]);

  useEffect(() => {
    if (isOpen) {
      checkDomainLinkingDraft({ nft: domainNft! });
    }
  }, [domainNft, isOpen]);

  const handlePasswordSubmit = useLastCallback((password: string) => {
    if (canSubmit) {
      submitDomainLinking({ password });
    }
  });

  const handleHardwareSubmit = useLastCallback(() => {
    if (canSubmit) {
      submitDomainLinkingHardware();
    }
  });

  const handleInfoClick = useLastCallback(() => {
    cancelDomainLinking();
    showActivityInfo({ id: txId! });
  });

  function renderInitialContent() {
    return (
      <>
        <ModalHeader title={lang(modalTitle)} onClose={cancelDomainLinking} />

        <div className={modalStyles.transitionContent}>
          <div className={styles.nftContainer}>
            <NftInfo nft={domainNft} withMediaViewer />

            <AddressInput
              label={currentLinkedWalletAddress ? lang('Linked Wallet') : lang('Wallet')}
              value={walletAddress}
              error={hasAddressError ? lang('Incorrect address') : undefined}
              isFocused={isAddressFocused}
              isQrScannerSupported={isQrScannerSupported}
              withPasteButton={withPasteButton}
              address={resolvedWalletAddress || walletAddress}
              addressName={localAddressName || walletAddressName}
              inputRef={addressInputRef}
              onInput={handleWalletAddressInput}
              onFocus={handleAddressFocus}
              onBlur={handleAddressBlur}
              onClearClick={handleAddressClear}
              onQrScanClick={handleQrScanClick}
              onPasteClick={handlePasteClick}
            />

            {shouldUseAddressBook && (
              <AddressBook
                isOpen={isAddressBookOpen}
                isNftTransfer={true} // Linking domain to address is an operation with NFT
                currentAddress={walletAddress}
                otherAccountIds={addressBookAccountIds}
                onAddressSelect={handleAddressBookItemSelect}
                onSavedAddressDelete={handleDeleteSavedAddressClick}
                onClose={closeAddressBook}
              />
            )}
          </div>

          <FeeLine terms={feeTerms} token={TONCOIN} precision="exact" />
          <div className={buildClassName(modalStyles.buttons, styles.footer)}>
            <Button
              isPrimary
              isDestructive={isInsufficientBalance}
              isDisabled={!canSubmit}
              isLoading={!realFee || isLoading}
              className={styles.button}
              onClick={startDomainLinking}
            >
              {isInsufficientBalance
                ? lang('Insufficient Balance')
                : lang('Link')}
            </Button>
          </div>
        </div>
        <DeleteSavedAddressModal
          isOpen={Boolean(addressForDeletion)}
          address={addressForDeletion}
          chain={chainForDeletion}
          onClose={handleDeleteSavedAddressModalClose}
        />
      </>
    );
  }

  function renderPasswordForm(isActive: boolean) {
    return (
      <>
        {!getDoesUsePinPad() && <ModalHeader title={lang('Confirm Linking')} onClose={cancelDomainLinking} />}
        <PasswordForm
          isActive={isActive}
          error={error}
          isLoading={isLoading}
          submitLabel={lang('Confirm')}
          cancelLabel={lang('Cancel')}
          onSubmit={handlePasswordSubmit}
          onCancel={cancelDomainLinking}
          onUpdate={clearDomainLinkingError}
          skipAuthScreen
        >
          <TransactionBanner
            imageUrl={domainNft?.thumbnail}
            text={domainNft?.name ?? '1 domain'}
            className={!getDoesUsePinPad() ? styles.transactionBanner : undefined}
          />
        </PasswordForm>
      </>
    );
  }

  function renderComplete(isActive: boolean) {
    return (
      <>
        <ModalHeader title={lang('Domain has been linked!')} onClose={cancelDomainLinking} />

        <div className={modalStyles.transitionContent}>
          <AnimatedIconWithPreview
            play={isActive}
            noLoop={false}
            nonInteractive
            className={styles.sticker}
            tgsUrl={ANIMATED_STICKERS_PATHS.thumbUp}
            previewUrl={ANIMATED_STICKERS_PATHS.thumbUpPreview}
          />
          <NftInfo nft={domainNft} withMediaViewer />
          {!!txId && (
            <div className={buildClassName(styles.buttons, styles.buttonsAfterNft)}>
              <Button onClick={handleInfoClick}>{lang('Details')}</Button>
            </div>
          )}

          <div className={modalStyles.buttons}>
            <Button className={styles.button} onClick={cancelDomainLinking} isPrimary>
              {lang('Close')}
            </Button>
          </div>
        </div>
      </>
    );
  }

  function renderContent(isActive: boolean, isFrom: boolean, currentKey: DomainLinkingState) {
    switch (currentKey) {
      case DomainLinkingState.Initial:
        return renderInitialContent();

      case DomainLinkingState.Password:
        return renderPasswordForm(isActive);

      case DomainLinkingState.ConnectHardware:
        return (
          <LedgerConnect
            isActive={isActive}
            state={hardwareState}
            isLedgerConnected={isLedgerConnected}
            isTonAppConnected={isTonAppConnected}
            onConnected={handleHardwareSubmit}
            onClose={cancelDomainLinking}
          />
        );

      case DomainLinkingState.ConfirmHardware:
        return (
          <LedgerConfirmOperation
            text={lang('Please confirm transaction on your Ledger')}
            error={error}
            onClose={cancelDomainLinking}
            onTryAgain={handleHardwareSubmit}
          />
        );

      case DomainLinkingState.Complete:
        return renderComplete(isActive);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      nativeBottomSheetKey="link-domain"
      forceFullNative={forceFullNative}
      dialogClassName={styles.modalDialog}
      onClose={cancelDomainLinking}
    >
      <Transition
        name={resolveSlideTransitionName()}
        className={buildClassName(modalStyles.transition, 'custom-scroll')}
        slideClassName={modalStyles.transitionSlide}
        activeKey={renderingKey}
        nextKey={nextKey}
      >
        {renderContent}
      </Transition>
    </Modal>
  );
}

export default memo(
  withGlobal((global): StateProps => {
    const {
      currentDomainLinking,
      mediaViewer: { mediaId },
    } = global;
    const currentAccount = selectCurrentAccount(global);
    const accountState = selectCurrentAccountState(global);
    const { byAddress } = accountState?.nfts || {};
    const { hardwareState, isLedgerConnected, isTonAppConnected } = global.hardware;
    const domainNft = currentDomainLinking.address ? byAddress?.[currentDomainLinking.address] : undefined;
    const currentLinkedWalletAddress = domainNft ? selectTonDnsLinkedAddress(global, domainNft) : '';

    return {
      isMediaViewerOpen: Boolean(mediaId),
      currentDomainLinking,
      byAddress,
      hardwareState,
      isLedgerConnected,
      isTonAppConnected,
      tonBalance: selectCurrentToncoinBalance(global),
      accounts: selectNetworkAccounts(global),
      savedAddresses: accountState?.savedAddresses,
      currentLinkedWalletAddress,
      currentTonAddress: currentAccount?.addressByChain.ton,
    };
  })(LinkingDomainModal),
);

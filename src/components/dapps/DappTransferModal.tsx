import React, {
  memo, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { GlobalState, HardwareConnectState, UserToken } from '../../global/types';
import { TransferState } from '../../global/types';

import { ANIMATED_STICKER_SMALL_SIZE_PX, IS_CAPACITOR, TONCOIN } from '../../config';
import { selectCurrentAccountTokens } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import resolveSlideTransitionName from '../../util/resolveSlideTransitionName';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';

import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useModalTransitionKeys from '../../hooks/useModalTransitionKeys';

import LedgerConfirmOperation from '../ledger/LedgerConfirmOperation';
import LedgerConnect from '../ledger/LedgerConnect';
import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import ModalHeader from '../ui/ModalHeader';
import PasswordForm from '../ui/PasswordForm';
import Transition from '../ui/Transition';
import DappLedgerWarning from './DappLedgerWarning';
import DappTransfer from './DappTransfer';
import DappTransferInitial from './DappTransferInitial';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Dapp.module.scss';

interface StateProps {
  currentDappTransfer: GlobalState['currentDappTransfer'];
  tokens?: UserToken[];
  hardwareState?: HardwareConnectState;
  isLedgerConnected?: boolean;
  isTonAppConnected?: boolean;
  isMediaViewerOpen?: boolean;
}

function DappTransferModal({
  currentDappTransfer: {
    dapp,
    transactions,
    isLoading,
    viewTransactionOnIdx,
    state,
    error,
  },
  tokens,
  hardwareState,
  isLedgerConnected,
  isTonAppConnected,
  isMediaViewerOpen,
}: StateProps) {
  const {
    setDappTransferScreen,
    clearDappTransferError,
    submitDappTransferPassword,
    submitDappTransferHardware,
    closeDappTransfer,
    cancelDappTransfer,
  } = getActions();

  const lang = useLang();
  const tonToken = useMemo(() => tokens?.find(({ slug }) => slug === TONCOIN.slug), [tokens])!;

  const isOpen = state !== TransferState.None;

  const [forceFullNative, setForceFullNative] = useState(false);
  const { renderingKey, nextKey, updateNextKey } = useModalTransitionKeys(state, isOpen);
  const renderingTransactions = useCurrentOrPrev(transactions, true);
  const isNftTransfer = renderingTransactions?.[0].payload?.type === 'nft:transfer';
  const isDappLoading = dapp === undefined;
  const withPayloadWarning = renderingTransactions?.[0].payload?.type === 'unknown';

  useEffect(() => {
    setForceFullNative(isOpen && (withPayloadWarning || renderingKey === TransferState.Password));
  }, [withPayloadWarning, renderingKey, isOpen]);

  const handleBackClick = useLastCallback(() => {
    if (state === TransferState.Confirm || state === TransferState.Password) {
      setDappTransferScreen({ state: TransferState.Initial });
    }
  });

  const handleTransferPasswordSubmit = useLastCallback((password: string) => {
    submitDappTransferPassword({ password });
  });

  const handleLedgerConnect = useLastCallback(() => {
    submitDappTransferHardware();
  });

  const handleResetTransfer = useLastCallback(() => {
    cancelDappTransfer();
    updateNextKey();
  });

  function renderSingleTransaction(isActive: boolean) {
    const transaction = viewTransactionOnIdx !== undefined ? transactions?.[viewTransactionOnIdx] : undefined;

    return (
      <>
        <ModalHeader title={lang('Is it all ok?')} onClose={closeDappTransfer} />
        <div className={modalStyles.transitionContent}>
          <AnimatedIconWithPreview
            size={ANIMATED_STICKER_SMALL_SIZE_PX}
            play={isActive}
            noLoop={false}
            nonInteractive
            className={buildClassName(styles.sticker, styles.sticker_sizeSmall)}
            tgsUrl={ANIMATED_STICKERS_PATHS.bill}
            previewUrl={ANIMATED_STICKERS_PATHS.billPreview}
          />

          {Boolean(transaction) && (
            <DappTransfer
              transaction={transaction}
              tonToken={tonToken}
              tokens={tokens}
            />
          )}
          <div className={modalStyles.buttons}>
            <Button onClick={handleBackClick}>{lang('Back')}</Button>
          </div>
        </div>
      </>
    );
  }

  function renderPassword(isActive: boolean) {
    return (
      <>
        {!IS_CAPACITOR && <ModalHeader title={lang('Confirm Action')} onClose={closeDappTransfer} />}
        <PasswordForm
          isActive={isActive}
          isLoading={isLoading}
          error={error}
          withCloseButton={IS_CAPACITOR}
          submitLabel={lang('Send')}
          cancelLabel={lang('Back')}
          onSubmit={handleTransferPasswordSubmit}
          onCancel={handleBackClick}
          onUpdate={clearDappTransferError}
        />
      </>
    );
  }

  function renderWaitForConnection() {
    const renderRow = (isLarge?: boolean) => (
      <div className={buildClassName(styles.rowContainerSkeleton, isLarge && styles.rowContainerLargeSkeleton)}>
        <div className={buildClassName(styles.rowTextSkeleton, isLarge && styles.rowTextLargeSkeleton)} />
        <div className={buildClassName(styles.rowSkeleton, isLarge && styles.rowLargeSkeleton)} />
      </div>
    );

    return (
      <>
        <ModalHeader title={lang('Send Transaction')} onClose={closeDappTransfer} />
        <div className={modalStyles.transitionContent}>
          <div className={styles.transactionDirection}>
            <div className={styles.transactionDirectionLeftSkeleton}>
              <div className={buildClassName(styles.nameSkeleton, styles.nameDappSkeleton)} />
              <div className={buildClassName(styles.descSkeleton, styles.descDappSkeleton)} />
            </div>
            <div className={styles.transactionDirectionRightSkeleton}>
              <div className={buildClassName(styles.dappInfoIconSkeleton, styles.transactionDappIconSkeleton)} />
              <div className={styles.dappInfoDataSkeleton}>
                <div className={buildClassName(styles.nameSkeleton, styles.nameDappSkeleton)} />
                <div className={buildClassName(styles.descSkeleton, styles.descDappSkeleton)} />
              </div>
            </div>
          </div>
          {renderRow(true)}
          {renderRow()}
          {renderRow()}
        </div>
      </>
    );
  }

  function renderTransferInitialWithSkeleton() {
    return (
      <Transition name="semiFade" activeKey={isDappLoading ? 0 : 1} slideClassName={styles.skeletonTransitionWrapper}>
        {isDappLoading ? renderWaitForConnection() : (
          <>
            <ModalHeader title={lang(isNftTransfer ? 'Send NFT' : 'Send Transaction')} onClose={closeDappTransfer} />
            <DappTransferInitial onClose={closeDappTransfer} tonToken={tonToken} />
          </>
        )}
      </Transition>
    );
  }

  // eslint-disable-next-line consistent-return
  function renderContent(isActive: boolean, isFrom: boolean, currentKey: number) {
    switch (currentKey) {
      case TransferState.Initial:
        return renderTransferInitialWithSkeleton();
      case TransferState.WarningHardware:
        return (
          <>
            <ModalHeader title={lang('Send Transaction')} onClose={closeDappTransfer} />
            <DappLedgerWarning tonToken={tonToken} />
          </>
        );
      case TransferState.Confirm:
        return renderSingleTransaction(isActive);
      case TransferState.Password:
        return renderPassword(isActive);
      case TransferState.ConnectHardware:
        return (
          <LedgerConnect
            isActive={isActive}
            state={hardwareState}
            isTonAppConnected={isTonAppConnected}
            isLedgerConnected={isLedgerConnected}
            onConnected={handleLedgerConnect}
            onClose={closeDappTransfer}
          />
        );
      case TransferState.ConfirmHardware:
        return (
          <LedgerConfirmOperation
            text={lang('Please confirm transaction on your Ledger')}
            error={error}
            onTryAgain={submitDappTransferHardware}
            onClose={closeDappTransfer}
          />
        );
    }
  }

  return (
    <Modal
      hasCloseButton
      isOpen={isOpen && !isMediaViewerOpen}
      noBackdropClose
      dialogClassName={buildClassName(styles.modalDialog, withPayloadWarning && styles.modalDialogExtraHeight)}
      nativeBottomSheetKey="dapp-transfer"
      forceFullNative={forceFullNative}
      onClose={closeDappTransfer}
      onCloseAnimationEnd={handleResetTransfer}
    >
      <Transition
        name={resolveSlideTransitionName()}
        className={buildClassName(modalStyles.transition, 'custom-scroll')}
        slideClassName={modalStyles.transitionSlide}
        activeKey={renderingKey}
        nextKey={nextKey}
        onStop={updateNextKey}
      >
        {renderContent}
      </Transition>
    </Modal>
  );
}

export default memo(withGlobal((global): StateProps => {
  const {
    hardwareState,
    isLedgerConnected,
    isTonAppConnected,
  } = global.hardware;

  return {
    currentDappTransfer: global.currentDappTransfer,
    tokens: selectCurrentAccountTokens(global),
    hardwareState,
    isLedgerConnected,
    isTonAppConnected,
    isMediaViewerOpen: Boolean(global.mediaViewer.mediaId),
  };
})(DappTransferModal));

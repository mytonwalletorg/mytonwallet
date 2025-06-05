import React, { memo, useMemo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiActivity, ApiDappTransfer, ApiToken } from '../../api/types';
import type { GlobalState, HardwareConnectState } from '../../global/types';
import { TransferState } from '../../global/types';

import { IS_CAPACITOR } from '../../config';
import { selectCurrentDappTransferTotals } from '../../global/selectors';
import { getDoesUsePinPad } from '../../util/biometrics';
import buildClassName from '../../util/buildClassName';
import resolveSlideTransitionName from '../../util/resolveSlideTransitionName';
import { isNftTransferPayload } from '../../util/ton/transfer';

import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useModalTransitionKeys from '../../hooks/useModalTransitionKeys';

import LedgerConfirmOperation from '../ledger/LedgerConfirmOperation';
import LedgerConnect from '../ledger/LedgerConnect';
import { getActivityHeight } from '../main/sections/Content/Activity';
import Modal from '../ui/Modal';
import ModalHeader from '../ui/ModalHeader';
import PasswordForm from '../ui/PasswordForm';
import Skeleton from '../ui/Skeleton';
import Transition from '../ui/Transition';
import DappLedgerWarning from './DappLedgerWarning';
import DappTransaction from './DappTransaction';
import DappTransferInitial from './DappTransferInitial';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Dapp.module.scss';

interface StateProps {
  currentDappTransfer: GlobalState['currentDappTransfer'];
  tokensBySlug: Record<string, ApiToken>;
  hardwareState?: HardwareConnectState;
  isLedgerConnected?: boolean;
  isTonAppConnected?: boolean;
  isMediaViewerOpen?: boolean;
  isDangerous: boolean;
}

function DappTransferModal({
  currentDappTransfer: {
    dapp,
    isLoading,
    viewTransactionOnIdx,
    state,
    transactions,
    emulation,
    error,
  },
  tokensBySlug,
  hardwareState,
  isLedgerConnected,
  isTonAppConnected,
  isMediaViewerOpen,
  isDangerous,
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

  const isOpen = state !== TransferState.None;

  const { renderingKey, nextKey, updateNextKey } = useModalTransitionKeys(state, isOpen);
  const renderingTransactions = useCurrentOrPrev(transactions, true);
  const isDappLoading = dapp === undefined;
  const needsExtraHeight = useMemo(
    () => shouldForceFullScreen(transactions, emulation?.activities, isDangerous),
    [transactions, emulation, isDangerous],
  );

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

  function renderPassword(isActive: boolean) {
    return (
      <>
        {!getDoesUsePinPad() && (
          <ModalHeader title={lang('Confirm Action')} onClose={closeDappTransfer} />
        )}
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
    const renderRow = (isLarge?: boolean, hasFee?: boolean) => (
      <div className={styles.rowContainerSkeleton}>
        <Skeleton className={buildClassName(styles.rowLabelSkeleton, isLarge && styles.rowTextLargeSkeleton)} />
        <Skeleton className={buildClassName(styles.rowSkeleton, isLarge && styles.rowLargeSkeleton)} />
        {hasFee && <Skeleton className={styles.rowFeeSkeleton} />}
      </div>
    );

    return (
      <div className={buildClassName(modalStyles.transitionContent, styles.skeletonBackground)}>
        <div className={styles.transactionDirection}>
          <div className={styles.transactionDirectionLeftSkeleton}>
            <Skeleton className={buildClassName(styles.nameSkeleton, styles.nameDappSkeleton)} />
            <Skeleton className={buildClassName(styles.descSkeleton, styles.descDappSkeleton)} />
          </div>
          <div className={styles.transactionDirectionRightSkeleton}>
            <Skeleton className={styles.dappInfoIconSkeleton} />
            <div className={styles.dappInfoDataSkeleton}>
              <Skeleton className={buildClassName(styles.nameSkeleton, styles.nameDappSkeleton)} />
              <Skeleton className={buildClassName(styles.descSkeleton, styles.descDappSkeleton)} />
            </div>
          </div>
        </div>
        {renderRow()}
        {renderRow(true, true)}
      </div>
    );
  }

  function renderTransferInitialWithSkeleton() {
    return (
      <Transition name="semiFade" activeKey={isDappLoading ? 0 : 1} slideClassName={styles.skeletonTransitionWrapper}>
        <ModalHeader
          title={lang(isNftTransferPayload(renderingTransactions?.[0]?.payload) ? 'Send NFT' : 'Send Transaction')}
          onClose={closeDappTransfer}
        />
        {isDappLoading ? renderWaitForConnection() : <DappTransferInitial onClose={closeDappTransfer} />}
      </Transition>
    );
  }

  function renderContent(isActive: boolean, isFrom: boolean, currentKey: TransferState) {
    switch (currentKey) {
      case TransferState.Initial:
        return renderTransferInitialWithSkeleton();
      case TransferState.WarningHardware:
        return (
          <>
            <ModalHeader title={lang('Send Transaction')} onClose={closeDappTransfer} />
            <DappLedgerWarning />
          </>
        );
      case TransferState.Confirm:
        return (
          <DappTransaction
            transaction={viewTransactionOnIdx !== undefined ? transactions?.[viewTransactionOnIdx] : undefined}
            tokensBySlug={tokensBySlug}
            isActive={isActive}
            onBack={handleBackClick}
            onClose={closeDappTransfer}
          />
        );
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
      dialogClassName={buildClassName(styles.modalDialog, needsExtraHeight && styles.modalDialogExtraHeight)}
      nativeBottomSheetKey="dapp-transfer"
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      forceFullNative={needsExtraHeight || renderingKey === TransferState.Password}
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
  const { isDangerous } = selectCurrentDappTransferTotals(global);

  return {
    currentDappTransfer: global.currentDappTransfer,
    tokensBySlug: global.tokenInfo.bySlug,
    hardwareState,
    isLedgerConnected,
    isTonAppConnected,
    isMediaViewerOpen: Boolean(global.mediaViewer.mediaId),
    isDangerous,
  };
})(DappTransferModal));

function shouldForceFullScreen(transactions?: ApiDappTransfer[], activities?: ApiActivity[], isDangerous?: boolean) {
  let height = 0; // rem

  if (transactions) {
    height += transactions.length * 3;
    if (transactions.length > 1) height += 5.125; // The Total Amount field
  }

  if (activities) {
    for (const activity of activities) {
      height += getActivityHeight(activity, true);
    }
  }

  if (isDangerous) {
    height += 4.6;
  }

  return height >= 14.5; // The actual available height is 15.125. Leaving a margin just in case.
}

import React, { memo, useMemo } from '../../lib/teact/teact';

import { TransferState } from '../../global/types';
import type { GlobalState, HardwareConnectState, UserToken } from '../../global/types';

import { ANIMATED_STICKER_SMALL_SIZE_PX, TON_TOKEN_SLUG } from '../../config';
import { getActions, withGlobal } from '../../global';
import { selectCurrentAccountTokens } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';

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
import DappTransaction from './DappTransaction';
import DappTransferInitial from './DappTransferInitial';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Dapp.module.scss';

interface StateProps {
  currentDappTransfer: GlobalState['currentDappTransfer'];
  tokens?: UserToken[];
  hardwareState?: HardwareConnectState;
  isLedgerConnected?: boolean;
  isTonAppConnected?: boolean;
}

function DappTransactionModal({
  currentDappTransfer: {
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
}: StateProps) {
  const {
    setDappTransferScreen,
    clearDappTransferError,
    submitDappTransferPassword,
    submitDappTransferHardware,
    cancelDappTransfer,
  } = getActions();

  const lang = useLang();
  const tonToken = useMemo(() => tokens?.find(({ slug }) => slug === TON_TOKEN_SLUG), [tokens])!;

  const isOpen = state !== TransferState.None;

  const { renderingKey, nextKey, updateNextKey } = useModalTransitionKeys(state, isOpen);

  const handleBackClick = useLastCallback(() => {
    if (state === TransferState.Confirm || state === TransferState.Password) {
      setDappTransferScreen({ state: TransferState.Initial });
    }
  });

  const handleTransferPasswordSubmit = useLastCallback((password: string) => {
    submitDappTransferPassword({ password });
  });

  function renderSingleTransaction(isActive: boolean) {
    const transaction = viewTransactionOnIdx !== undefined ? transactions?.[viewTransactionOnIdx] : undefined;

    return (
      <>
        <ModalHeader title={lang('Is it all ok?')} onClose={cancelDappTransfer} />
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
            <DappTransaction
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
        <ModalHeader title={lang('Confirm Transaction')} onClose={cancelDappTransfer} />
        <PasswordForm
          isActive={isActive}
          isLoading={isLoading}
          error={error}
          placeholder={lang('Enter your password')}
          onUpdate={clearDappTransferError}
          onSubmit={handleTransferPasswordSubmit}
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
      case TransferState.Initial:
        return (
          <>
            <ModalHeader title={lang('Send Transaction')} onClose={cancelDappTransfer} />
            <DappTransferInitial tonToken={tonToken} />
          </>
        );
      case TransferState.WarningHardware:
        return (
          <>
            <ModalHeader title={lang('Send Transaction')} onClose={cancelDappTransfer} />
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
            state={hardwareState}
            isTonAppConnected={isTonAppConnected}
            isLedgerConnected={isLedgerConnected}
            onConnected={submitDappTransferHardware}
            onClose={cancelDappTransfer}
          />
        );
      case TransferState.ConfirmHardware:
        return (
          <LedgerConfirmOperation
            text={lang('Please confirm transaction on your Ledger')}
            error={error}
            onTryAgain={submitDappTransferHardware}
            onClose={cancelDappTransfer}
          />
        );
    }
  }

  return (
    <Modal
      hasCloseButton
      isOpen={isOpen}
      onClose={cancelDappTransfer}
      noBackdropClose
      dialogClassName={styles.modalDialog}
      onCloseAnimationEnd={updateNextKey}
    >
      <Transition
        name="slideLayers"
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
  };
})(DappTransactionModal));

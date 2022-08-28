import React, {
  memo, useCallback, useEffect, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { TransferState } from '../../global/types';

import { ANIMATED_STICKER_SMALL_SIZE_PX, CARD_SECONDARY_VALUE_SYMBOL } from '../../config';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';
import { bigStrToHuman } from '../../global/helpers';
import buildClassName from '../../util/buildClassName';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import { formatCurrencyExtended } from '../../util/formatNumber';
import captureKeyboardListeners from '../../util/captureKeyboardListeners';

import Modal from '../ui/Modal';
import ModalHeader from '../ui/ModalHeader';
import Transition from '../ui/Transition';
import TransferInitial from './TransferInitial';
import PasswordForm from '../ui/PasswordForm';
import Button from '../ui/Button';
import AnimatedIcon from '../ui/AnimatedIcon';

import styles from './Transfer.module.scss';
import modalStyles from '../ui/Modal.module.scss';

interface StateProps {
  state: TransferState;
  toAddress?: string;
  amount?: number;
  fee?: string;
  comment?: string;
  promiseId?: string;
  error?: string;
  isLoading?: boolean;
  txId?: string;
}

function TransferModal({
  state, amount, toAddress, fee, comment, promiseId, error, isLoading, txId,
}: StateProps) {
  const {
    submitTransferConfirm, submitTransferPassword, setTransferScreen, cleanTransferError, cancelTransfer,
    showTransactionInfo,
  } = getActions();

  const isOpen = state !== TransferState.None;
  const renderingState = useCurrentOrPrev(isOpen ? state : undefined, true) ?? -1;
  const [nextKey, setNextKey] = useState(renderingState + 1);
  const updateNextKey = useCallback(() => {
    setNextKey(renderingState + 1);
  }, [renderingState]);

  useEffect(() => {
    if (isOpen) {
      updateNextKey();
    }
  }, [isOpen, updateNextKey]);

  useEffect(() => (
    state === TransferState.Confirm
      ? captureKeyboardListeners({
        onEnter: () => {
          submitTransferConfirm();
        },
      })
      : undefined
  ), [state, submitTransferConfirm]);

  const handleTransferSubmit = useCallback((password: string) => {
    submitTransferPassword({ password });
  }, [submitTransferPassword]);

  const handleModalClose = useCallback(() => {
    setNextKey(TransferState.None);
  }, []);

  const handleBackClick = useCallback(() => {
    if (state === TransferState.Confirm) {
      setTransferScreen({ state: TransferState.Initial });
    }
    if (state === TransferState.Password) {
      setTransferScreen({ state: TransferState.Confirm });
    }
    setNextKey(nextKey - 1);
  }, [nextKey, setTransferScreen, state]);

  const handleTransactionInfoClick = useCallback(() => {
    cancelTransfer();
    if (txId) {
      showTransactionInfo({ txId });
    }
  }, [cancelTransfer, showTransactionInfo, txId]);

  function renderComment() {
    if (!comment) {
      return undefined;
    }

    return (
      <>
        <div className={styles.label}>Comment</div>
        <div className={styles.inputReadOnly}>{comment}</div>
      </>
    );
  }

  function renderConfirm(isActive: boolean) {
    return (
      <>
        <ModalHeader title="Is it all ok?" onClose={cancelTransfer} />
        <div className={modalStyles.transitionContent}>
          <AnimatedIcon
            size={ANIMATED_STICKER_SMALL_SIZE_PX}
            play={isActive}
            noLoop={false}
            nonInteractive
            className={buildClassName(styles.sticker, styles.sticker_sizeSmall)}
            tgsUrl={ANIMATED_STICKERS_PATHS.bill}
          />
          <div className={styles.label}>Receiving address</div>
          <div className={styles.inputReadOnly}>
            {toAddress}
          </div>

          <div className={styles.label}>Amount</div>
          <div className={styles.inputReadOnly}>
            {formatCurrencyExtended(amount || 0, '', true)}
            <span className={styles.suffix}>{CARD_SECONDARY_VALUE_SYMBOL}</span>
            {fee && (
              <>
                <div className={styles.feeLabel}>Fee</div>
                <span className={styles.feeConfirm}>
                  {formatCurrencyExtended(bigStrToHuman(fee), CARD_SECONDARY_VALUE_SYMBOL)}
                </span>
              </>
            )}
          </div>

          {renderComment()}

          <div className={modalStyles.buttons}>
            {promiseId ? (
              <Button onClick={cancelTransfer}>Cancel</Button>
            ) : (
              <Button onClick={handleBackClick}>Edit</Button>
            )}
            <Button
              isPrimary
              isLoading={isLoading}
              onClick={submitTransferConfirm}
            >
              Confirm
            </Button>
          </div>
        </div>
      </>
    );
  }

  function renderPassword(isActive: boolean) {
    return (
      <>
        <ModalHeader title="Confirm Transaction" onClose={cancelTransfer} />
        <PasswordForm
          isActive={isActive}
          isLoading={isLoading}
          error={error}
          placeholder="Enter your password"
          onCleanError={cleanTransferError}
          onSubmit={handleTransferSubmit}
          submitLabel="Send"
          onCancel={handleBackClick}
          cancelLabel="Back"
        />
      </>
    );
  }

  function renderInProgress(isActive: boolean) {
    return (
      <>
        <ModalHeader title="Sending TON" onClose={cancelTransfer} />
        <div className={buildClassName(modalStyles.transitionContent, modalStyles.transitionContent_simple)}>
          <AnimatedIcon
            play={isActive}
            noLoop={false}
            nonInteractive
            className={styles.sticker}
            tgsUrl={ANIMATED_STICKERS_PATHS.stonks}
          />
          <div className={styles.description}>
            Please wait a few seconds for your <br /> transaction to be processed...
          </div>
        </div>
      </>
    );
  }

  function renderComplete(isActive: boolean) {
    return (
      <>
        <ModalHeader title="Done!" onClose={cancelTransfer} />

        <div className={buildClassName(modalStyles.transitionContent, modalStyles.transitionContent_simple)}>
          <AnimatedIcon
            play={isActive}
            noLoop={false}
            nonInteractive
            className={styles.sticker}
            tgsUrl={ANIMATED_STICKERS_PATHS.thumbUp}
          />
          <div className={styles.description}>
            <strong>{formatCurrencyExtended(amount || 0, CARD_SECONDARY_VALUE_SYMBOL, true)}</strong> have been sent.
          </div>

          <div className={modalStyles.buttons}>
            <Button onClick={handleTransactionInfoClick}>
              {txId ? 'Transaction Info' : 'Close'}
            </Button>
          </div>
        </div>
      </>
    );
  }

  // eslint-disable-next-line consistent-return
  function renderContent(isActive: boolean, isFrom: boolean, currentKey: number) {
    switch (currentKey) {
      case TransferState.Initial:
        return (
          <>
            <ModalHeader title="Send" onClose={cancelTransfer} />
            <TransferInitial />
          </>
        );

      case TransferState.Confirm:
        return renderConfirm(isActive);

      case TransferState.Password:
        return renderPassword(isActive);

      case TransferState.InProgress:
        return renderInProgress(isActive);

      case TransferState.Complete:
        return renderComplete(isActive);
    }
  }

  return (
    <Modal
      hasCloseButton
      isSlideUp
      isOpen={isOpen}
      onClose={cancelTransfer}
      onCloseAnimationEnd={handleModalClose}
      dialogClassName={styles.modalDialog}
    >
      <Transition
        name="push-slide"
        className={buildClassName(modalStyles.transition, 'custom-scroll')}
        slideClassName={modalStyles.transitionSlide}
        activeKey={renderingState}
        nextKey={nextKey}
        onStop={updateNextKey}
      >
        {renderContent}
      </Transition>
    </Modal>
  );
}

export default memo(withGlobal((global): StateProps => {
  return global.currentTransfer;
})(TransferModal));

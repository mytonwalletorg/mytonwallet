import React, {
  memo, useEffect, useMemo,
} from '../../lib/teact/teact';

import { TransferState } from '../../global/types';
import type { GlobalState, HardwareConnectState, UserToken } from '../../global/types';

import { ANIMATED_STICKER_SMALL_SIZE_PX, TON_TOKEN_SLUG } from '../../config';
import { getActions, withGlobal } from '../../global';
import { bigStrToHuman } from '../../global/helpers';
import { selectCurrentAccountState, selectCurrentAccountTokens } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import captureKeyboardListeners from '../../util/captureKeyboardListeners';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useModalTransitionKeys from '../../hooks/useModalTransitionKeys';
import usePrevious from '../../hooks/usePrevious';

import TransferResult from '../common/TransferResult';
import LedgerConfirmOperation from '../ledger/LedgerConfirmOperation';
import LedgerConnect from '../ledger/LedgerConnect';
import AmountWithFeeTextField from '../ui/AmountWithFeeTextField';
import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import Button from '../ui/Button';
import InteractiveTextField from '../ui/InteractiveTextField';
import Modal from '../ui/Modal';
import ModalHeader from '../ui/ModalHeader';
import PasswordForm from '../ui/PasswordForm';
import Transition from '../ui/Transition';
import TransferInitial from './TransferInitial';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Transfer.module.scss';

interface StateProps {
  currentTransfer: GlobalState['currentTransfer'];
  tokens?: UserToken[];
  savedAddresses?: Record<string, string>;
  hardwareState?: HardwareConnectState;
  isLedgerConnected?: boolean;
  isTonAppConnected?: boolean;
}

const AMOUNT_PRECISION = 4;

function TransferModal({
  currentTransfer: {
    state,
    amount,
    toAddress,
    resolvedAddress,
    fee,
    comment,
    shouldEncrypt,
    promiseId,
    error,
    isLoading,
    txId,
    tokenSlug,
    toAddressName,
  }, tokens, savedAddresses, hardwareState, isLedgerConnected, isTonAppConnected,
}: StateProps) {
  const {
    submitTransferConfirm,
    submitTransferPassword,
    submitTransferHardware,
    setTransferScreen,
    clearTransferError,
    cancelTransfer,
    showTransactionInfo,
    startTransfer,
  } = getActions();

  const lang = useLang();
  const isOpen = state !== TransferState.None;

  const selectedToken = useMemo(() => tokens?.find((token) => token.slug === tokenSlug), [tokenSlug, tokens]);
  const renderedTokenBalance = usePrevious(selectedToken?.amount, true);
  const renderedTransactionAmount = usePrevious(amount, true);
  const symbol = selectedToken?.symbol || '';

  const { renderingKey, nextKey, updateNextKey } = useModalTransitionKeys(state, isOpen);

  useEffect(() => (
    state === TransferState.Confirm
      ? captureKeyboardListeners({
        onEnter: () => {
          submitTransferConfirm();
        },
      })
      : undefined
  ), [state, submitTransferConfirm]);

  const handleTransferSubmit = useLastCallback((password: string) => {
    submitTransferPassword({ password });
  });

  const handleBackClick = useLastCallback(() => {
    if (state === TransferState.Confirm) {
      setTransferScreen({ state: TransferState.Initial });
    }
    if (state === TransferState.Password) {
      setTransferScreen({ state: TransferState.Confirm });
    }
  });

  const handleTransactionInfoClick = useLastCallback(() => {
    cancelTransfer();
    showTransactionInfo({ txId });
  });

  const handleTransactionRepeatClick = useLastCallback(() => {
    startTransfer({
      tokenSlug: tokenSlug || TON_TOKEN_SLUG,
      toAddress,
      amount,
      comment,
    });
  });

  const handleModalClose = useLastCallback(() => {
    cancelTransfer();
    updateNextKey();
  });

  function renderComment() {
    if (!comment) {
      return undefined;
    }

    return (
      <>
        <div className={styles.label}>{shouldEncrypt ? lang('Encrypted Message') : lang('Comment')}</div>
        <div className={buildClassName(styles.inputReadOnly, styles.inputReadOnly_words)}>{comment}</div>
      </>
    );
  }

  function renderConfirm(isActive: boolean) {
    const addressName = savedAddresses?.[toAddress!] || toAddressName;

    return (
      <>
        <ModalHeader title={lang('Is it all ok?')} onClose={cancelTransfer} />
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
          <div className={styles.label}>{lang('Receiving Address')}</div>
          <InteractiveTextField
            address={resolvedAddress!}
            addressName={addressName}
            copyNotification={lang('Address was copied!')}
            className={styles.addressWidget}
          />

          <AmountWithFeeTextField
            label={lang('Amount')}
            amount={amount || 0}
            symbol={symbol}
            fee={fee ? bigStrToHuman(fee) : undefined}
          />

          {renderComment()}

          <div className={modalStyles.buttons}>
            {promiseId ? (
              <Button onClick={cancelTransfer}>{lang('Cancel')}</Button>
            ) : (
              <Button onClick={handleBackClick}>{lang('Edit')}</Button>
            )}
            <Button
              isPrimary
              isLoading={isLoading}
              onClick={submitTransferConfirm}
            >
              {lang('Confirm')}
            </Button>
          </div>
        </div>
      </>
    );
  }

  function renderPassword(isActive: boolean) {
    return (
      <>
        <ModalHeader title={lang('Confirm Transaction')} onClose={cancelTransfer} />
        <PasswordForm
          isActive={isActive}
          isLoading={isLoading}
          error={error}
          placeholder={lang('Enter your password')}
          onUpdate={clearTransferError}
          onSubmit={handleTransferSubmit}
          submitLabel={lang('Send')}
          onCancel={handleBackClick}
          cancelLabel={lang('Back')}
        />
      </>
    );
  }

  function renderComplete(isActive: boolean) {
    return (
      <>
        <ModalHeader title={lang('Coins have been sent!')} onClose={cancelTransfer} />

        <div className={modalStyles.transitionContent}>
          <TransferResult
            playAnimation={isActive}
            amount={renderedTransactionAmount ? -renderedTransactionAmount : undefined}
            tokenSymbol={symbol}
            precision={AMOUNT_PRECISION}
            balance={renderedTokenBalance}
            fee={fee ? bigStrToHuman(fee) : 0}
            operationAmount={amount ? -amount : undefined}
            firstButtonText={txId ? lang('Details') : undefined}
            secondButtonText={lang('Repeat')}
            onFirstButtonClick={handleTransactionInfoClick}
            onSecondButtonClick={handleTransactionRepeatClick}
          />

          <div className={modalStyles.buttons}>
            <Button onClick={cancelTransfer} isPrimary>{lang('Close')}</Button>
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
            <ModalHeader title={lang('Send')} onClose={cancelTransfer} />
            <TransferInitial />
          </>
        );
      case TransferState.Confirm:
        return renderConfirm(isActive);
      case TransferState.Password:
        return renderPassword(isActive);
      case TransferState.ConnectHardware:
        return (
          <LedgerConnect
            state={hardwareState}
            isLedgerConnected={isLedgerConnected}
            isTonAppConnected={isTonAppConnected}
            onConnected={submitTransferHardware}
            onClose={cancelTransfer}
          />
        );
      case TransferState.ConfirmHardware:
        return (
          <LedgerConfirmOperation
            text={lang('Please confirm transaction on your Ledger')}
            error={error}
            onClose={cancelTransfer}
            onTryAgain={submitTransferHardware}
          />
        );
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
      noBackdropClose
      dialogClassName={styles.modalDialog}
      onCloseAnimationEnd={handleModalClose}
    >
      <Transition
        name="pushSlide"
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
  const accountState = selectCurrentAccountState(global);

  const {
    hardwareState,
    isLedgerConnected,
    isTonAppConnected,
  } = global.hardware;

  return {
    currentTransfer: global.currentTransfer,
    tokens: selectCurrentAccountTokens(global),
    savedAddresses: accountState?.savedAddresses,
    hardwareState,
    isLedgerConnected,
    isTonAppConnected,
  };
})(TransferModal));

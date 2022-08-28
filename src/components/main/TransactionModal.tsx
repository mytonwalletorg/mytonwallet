import React, {
  memo, useCallback, useLayoutEffect, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { ApiToken, ApiTransaction } from '../../api/types';

import { ANIMATED_STICKER_SMALL_SIZE_PX, CARD_SECONDARY_VALUE_SYMBOL } from '../../config';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';
import { bigStrToHuman } from '../../global/helpers';
import { formatCurrencyExtended } from '../../util/formatNumber';
import buildClassName from '../../util/buildClassName';
import { copyTextToClipboard } from '../../util/clipboard';

import Modal from '../ui/Modal';
import Button from '../ui/Button';
import AnimatedIcon from '../ui/AnimatedIcon';

import styles from './TransactionModal.module.scss';
import transferStyles from '../transfer/Transfer.module.scss';
import receiveStyles from './Receive.module.scss';
import modalStyles from '../ui/Modal.module.scss';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';

type StateProps = {
  transaction?: ApiTransaction;
  token?: ApiToken;
};

const EMPTY_HASH_VALUE = 'NOHASH';

function TransactionModal({ transaction, token }: StateProps) {
  const { startTransfer, showNotification, closeTransactionInfo } = getActions();

  const renderedTransaction = useCurrentOrPrev(transaction, true);

  const {
    fromAddress, toAddress, amount, comment, fee, txId, isIncoming,
  } = renderedTransaction || {};
  const [, transactionHash] = (txId || '').split(':');

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const amountHuman = amount ? bigStrToHuman(amount) : 0;
  const address = isIncoming ? fromAddress : toAddress;
  const tonscanTransactionUrl = transactionHash && transactionHash !== EMPTY_HASH_VALUE
    ? `https://tonscan.org/tx/${transactionHash}`
    : undefined;
  const tonscanAddressUrl = `https://tonscan.org/address/${address}`;

  useLayoutEffect(() => {
    if (transaction?.txId) {
      setIsModalOpen(true);
    }
  }, [transaction?.txId]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleCopyAddress = useCallback(() => {
    if (!address) return;

    showNotification({ message: 'Address was copied!', icon: 'icon-copy' });
    copyTextToClipboard(address);
  }, [address, showNotification]);

  const handleCopyComment = useCallback(() => {
    if (!comment) return;

    showNotification({ message: 'Comment was copied!', icon: 'icon-copy' });
    copyTextToClipboard(comment);
  }, [comment, showNotification]);

  const handleSendClick = useCallback(() => {
    handleCloseModal();
    startTransfer({
      toAddress: address,
      amount: Math.abs(amountHuman),
      comment: !isIncoming ? comment : undefined,
    });
  }, [handleCloseModal, startTransfer, address, amountHuman, isIncoming, comment]);

  function renderComment() {
    if (!comment) {
      return undefined;
    }

    return (
      <>
        <div className={transferStyles.label}>Comment</div>
        <div className={buildClassName(receiveStyles.copyButtonWrapper, styles.copyButtonWrapper)}>
          <span
            className={receiveStyles.copyButton}
            title="Copy comment"
            onClick={handleCopyComment}
            tabIndex={0}
            role="button"
          >
            {comment}
            <i className={buildClassName(receiveStyles.iconCopy, 'icon-copy')} aria-hidden />
          </span>
        </div>
      </>
    );
  }

  return (
    <Modal
      isSlideUp
      hasCloseButton
      title="Transaction Info"
      isOpen={isModalOpen}
      onClose={handleCloseModal}
      onCloseAnimationEnd={closeTransactionInfo}
    >
      <div className={modalStyles.transitionContent}>
        {tonscanTransactionUrl && (
          <a
            href={tonscanTransactionUrl}
            target="_blank"
            rel="noreferrer noopener"
            className={styles.tonscan}
            title="View transaction on TON Explorer"
          >
            <i className="icon-tonscan" aria-hidden />
          </a>
        )}
        <AnimatedIcon
          tgsUrl={ANIMATED_STICKERS_PATHS.bill}
          size={ANIMATED_STICKER_SMALL_SIZE_PX}
          noLoop={false}
          nonInteractive
          className={styles.sticker}
        />

        <div className={transferStyles.label}>{isIncoming ? 'Sender' : 'Recipient'}</div>
        <div className={buildClassName(receiveStyles.copyButtonWrapper, styles.copyButtonWrapper)}>
          <span
            className={receiveStyles.copyButton}
            title="Copy address"
            onClick={handleCopyAddress}
            tabIndex={0}
            role="button"
          >
            {address}
            <i className={buildClassName(receiveStyles.iconCopy, 'icon-copy')} aria-hidden />
          </span>
          <a
            href={tonscanAddressUrl}
            className={receiveStyles.copyButton}
            title="View address on TON Explorer"
            target="_blank"
            rel="noreferrer noopener"
          >
            <i className={buildClassName(receiveStyles.iconCopy, 'icon-tonscan')} aria-hidden />
          </a>
        </div>

        <div className={transferStyles.label}>Amount</div>
        <div className={transferStyles.inputReadOnly}>
          <span className={isIncoming ? styles.amount_operationPositive : styles.amount_operationNegative}>
            {formatCurrencyExtended(amountHuman, '')}
            {' '}
            {token?.symbol || CARD_SECONDARY_VALUE_SYMBOL}
          </span>
          {!isIncoming && fee && (
            <>
              <div className={transferStyles.feeLabel}>Fee</div>
              <span className={transferStyles.feeConfirm}>
                {formatCurrencyExtended(bigStrToHuman(fee), token?.symbol || CARD_SECONDARY_VALUE_SYMBOL, true)}
              </span>
            </>
          )}
        </div>

        {renderComment()}

        <div className={styles.footer}>
          <Button onClick={handleSendClick} className={styles.button}>
            {isIncoming ? 'Send back' : 'Repeat'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default memo(withGlobal(
  (global): StateProps => {
    const txId = global.currentTransactionId;
    const transaction = txId ? global.transactions?.byTxId[txId] : undefined;
    const token = transaction?.slug ? global.tokenInfo?.bySlug[transaction.slug] : undefined;

    return {
      transaction,
      token,
    };
  },
)(TransactionModal));

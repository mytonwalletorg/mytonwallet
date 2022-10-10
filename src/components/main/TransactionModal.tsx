import React, {
  memo, useCallback, useEffect, useState, useRef,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { ApiToken, ApiTransaction } from '../../api/types';

import { CARD_SECONDARY_VALUE_SYMBOL, TON_TOKEN_SLUG, TONSCAN_BASE_URL } from '../../config';
import { bigStrToHuman, getIsTxIdLocal } from '../../global/helpers';
import { formatCurrencyExtended } from '../../util/formatNumber';
import buildClassName from '../../util/buildClassName';
import { formatFullDay, formatTime } from '../../util/dateFormat';
import { copyTextToClipboard } from '../../util/clipboard';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useFlag from '../../hooks/useFlag';
import useFocusAfterAnimation from '../../hooks/useFocusAfterAnimation';
import useOnChange from '../../hooks/useOnChange';

import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import DeleteSavedAddressModal from './DeleteSavedAddressModal';
import TransactionAmount from '../common/TransactionAmount';

import styles from './TransactionModal.module.scss';
import transferStyles from '../transfer/Transfer.module.scss';
import receiveStyles from './Receive.module.scss';
import modalStyles from '../ui/Modal.module.scss';

type StateProps = {
  transaction?: ApiTransaction;
  token?: ApiToken;
  isAddressAlreadySaved?: boolean;
};

const EMPTY_HASH_VALUE = 'NOHASH';
const SAVED_ADDRESS_NAME_MAX_LENGTH = 255;

function TransactionModal({
  transaction,
  token,
  isAddressAlreadySaved,
}: StateProps) {
  const {
    startTransfer,
    showNotification,
    closeTransactionInfo,
    addSavedAddress,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const addressNameRef = useRef<HTMLInputElement>(null);

  const renderedTransaction = useCurrentOrPrev(transaction, true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSaveAddressModalOpen, openSaveAddressModal, closeSaveAddressModal] = useFlag();
  const [isDeleteSavedAddressModalOpen, openDeletedSavedAddressModal, closeDeleteSavedAddressModal] = useFlag();
  const [savedAddressName, setSavedAddressName] = useState<string>();

  const {
    fromAddress, toAddress, amount, comment, fee, txId, isIncoming, slug, timestamp,
  } = renderedTransaction || {};
  const [, transactionHash] = (txId || '').split(':');

  const amountHuman = amount ? bigStrToHuman(amount) : 0;
  const address = isIncoming ? fromAddress : toAddress;
  const tonscanTransactionUrl = transactionHash && transactionHash !== EMPTY_HASH_VALUE
    ? `${TONSCAN_BASE_URL}tx/${transactionHash}`
    : undefined;
  const tonscanAddressUrl = `${TONSCAN_BASE_URL}address/${address}`;

  useEffect(() => {
    if (isSaveAddressModalOpen) {
      setSavedAddressName('');
    }
  }, [isSaveAddressModalOpen]);

  useOnChange(() => {
    if (transaction) {
      setIsModalOpen(true);
    }
  }, [transaction]);

  useFocusAfterAnimation({
    ref: addressNameRef,
    isActive: isSaveAddressModalOpen,
  });

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
      tokenSlug: slug || TON_TOKEN_SLUG,
      toAddress: address,
      amount: Math.abs(amountHuman),
      comment: !isIncoming ? comment : undefined,
    });
  }, [handleCloseModal, startTransfer, slug, address, amountHuman, isIncoming, comment]);

  const handleSaveAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!savedAddressName || !address) {
      return;
    }

    addSavedAddress({ address, name: savedAddressName });
    closeSaveAddressModal();
  };

  function renderHeader() {
    const isLocal = txId && getIsTxIdLocal(txId);

    return (
      <>
        {timestamp ? `${formatFullDay(timestamp)}, ${formatTime(timestamp)}` : 'Transaction Info'}
        {isLocal && <i className={buildClassName(styles.clockIcon, 'icon-clock')} title="Transaction in progress" />}
      </>
    );
  }

  function renderFee() {
    if (isIncoming || !fee) {
      return undefined;
    }

    return (
      <>
        <div className={transferStyles.label}>Fee</div>
        <div className={transferStyles.inputReadOnly}>
          {formatCurrencyExtended(bigStrToHuman(fee), CARD_SECONDARY_VALUE_SYMBOL, true)}
        </div>
      </>
    );
  }

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

  function renderModal() {
    return (
      <Modal
        isSlideUp
        hasCloseButton
        title={renderHeader()}
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
          <TransactionAmount isIncoming={isIncoming} amount={amountHuman} tokenSymbol={token?.symbol} />

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
            <span
              className={receiveStyles.copyButton}
              title={isAddressAlreadySaved ? 'Remove From Saved Addresses' : 'Add To Saved Addresses'}
              onClick={isAddressAlreadySaved ? openDeletedSavedAddressModal : openSaveAddressModal}
              tabIndex={0}
              role="button"
            >
              <i
                className={buildClassName(
                  receiveStyles.iconCopy,
                  styles.iconStar,
                  isAddressAlreadySaved ? 'icon-star-filled' : 'icon-star',
                )}
                aria-hidden
              />
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

          {renderFee()}

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

  function renderSaveAddressModal() {
    return (
      <Modal
        title="Save Address"
        isCompact
        isOpen={isSaveAddressModalOpen}
        onClose={closeSaveAddressModal}
      >
        <form onSubmit={handleSaveAddressSubmit}>
          <p>You can save this address for quick access while sending.</p>
          <Input
            ref={addressNameRef}
            placeholder="Name"
            onInput={setSavedAddressName}
            value={savedAddressName}
            maxLength={SAVED_ADDRESS_NAME_MAX_LENGTH}
            className={styles.nameInput}
          />

          <div className={modalStyles.buttons}>
            <Button onClick={closeSaveAddressModal}>Cancel</Button>
            <Button isPrimary isDisabled={!savedAddressName} isSubmit>Save</Button>
          </div>
        </form>
      </Modal>
    );
  }

  return (
    <>
      {renderModal()}
      {renderSaveAddressModal()}
      <DeleteSavedAddressModal
        isOpen={isDeleteSavedAddressModalOpen}
        address={address}
        onClose={closeDeleteSavedAddressModal}
      />
    </>
  );
}

export default memo(withGlobal(
  (global): StateProps => {
    const txId = global.currentTransactionId;
    const transaction = txId ? global.transactions?.byTxId[txId] : undefined;
    const token = transaction?.slug ? global.tokenInfo?.bySlug[transaction.slug] : undefined;
    const address = transaction?.isIncoming ? transaction.fromAddress : transaction?.toAddress;
    const isAddressAlreadySaved = Boolean(address && global.savedAddresses?.[address]);

    return {
      transaction,
      token,
      isAddressAlreadySaved,
    };
  },
)(TransactionModal));

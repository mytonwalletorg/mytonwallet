import QrCodeStyling from 'qr-code-styling';
import TonWeb from 'tonweb';
import React, {
  memo, useCallback, useEffect, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { TONSCAN_BASE_URL } from '../../config';
import { humanToBigStr } from '../../global/helpers';
import { copyTextToClipboard } from '../../util/clipboard';
import buildClassName from '../../util/buildClassName';
import useFlag from '../../hooks/useFlag';
import { shortenAddress } from '../../util/shortenAddress';

import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import InputNumberRich from '../ui/InputNumberRich';

import styles from './Receive.module.scss';
import modalStyles from '../ui/Modal.module.scss';

interface StateProps {
  address?: string;
}

type OwnProps = {
  isOpen: boolean;
  onClose: () => void;
};

const QR_SIZE = 600;
const QR_CODE = new QrCodeStyling({
  width: QR_SIZE,
  height: QR_SIZE,
  image: './logo.svg',
  margin: 0,
  type: 'canvas',
  dotsOptions: {
    type: 'rounded',
  },
  cornersSquareOptions: {
    type: 'extra-rounded',
  },
  imageOptions: {
    imageSize: 0.4,
    margin: 8,
    crossOrigin: 'anonymous',
  },
  qrOptions: {
    errorCorrectionLevel: 'M',
  },
});

function Receive({
  isOpen,
  address,
  onClose,
}: StateProps & OwnProps) {
  const { showNotification } = getActions();
  // eslint-disable-next-line no-null/no-null
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [comment, setComment] = useState<string>('');
  const [hasAmountError, setHasAmountError] = useState<boolean>(false);
  const [isQrModalOpen, openQrModal, closeQrModal] = useFlag(false);
  const [isInvoiceModalOpen, openInvoiceModal, closeInvoiceModal] = useFlag(false);
  const tonscanAddressUrl = `${TONSCAN_BASE_URL}address/${address}`;

  useEffect(() => {
    if (isQrModalOpen) {
      QR_CODE.append(qrCodeRef.current || undefined);
    }
  }, [isQrModalOpen]);

  useEffect(() => {
    if (!address) {
      return;
    }
    QR_CODE.update({ data: TonWeb.utils.formatTransferUrl(address) });
  }, [address]);

  const handleAmountInput = useCallback((value?: number) => {
    setHasAmountError(false);

    if (value === undefined) {
      setAmount(undefined);
      return;
    }

    if (Number.isNaN(value) || value < 0) {
      setHasAmountError(true);
      return;
    }

    setAmount(value);
  }, []);

  const handleCopyAddress = useCallback(() => {
    if (!address) return;

    showNotification({ message: 'Address was copied!', icon: 'icon-copy' });
    copyTextToClipboard(address);
  }, [address, showNotification]);

  const handleCopyInvoiceLink = useCallback(() => {
    if (!address) return;

    showNotification({ message: 'Invoice link was copied!', icon: 'icon-copy' });
    const invoiceAmount = amount ? humanToBigStr(amount) : undefined;
    copyTextToClipboard(TonWeb.utils.formatTransferUrl(address, invoiceAmount, comment));
  }, [address, amount, comment, showNotification]);

  const handleClose = useCallback(() => {
    onClose();
    closeInvoiceModal();
    closeQrModal();
  }, [closeInvoiceModal, closeQrModal, onClose]);

  function renderReceive() {
    return (
      <Modal
        isSlideUp
        hasCloseButton
        title="Receive TON"
        isOpen={isOpen}
        onClose={handleClose}
      >
        <div className={modalStyles.transitionContent}>
          <div className={styles.info}>
            You can share this address, show QR-code <br />
            or create invoice to receive TON
          </div>

          <p className={styles.description}>Your address</p>
          <div className={styles.copyButtonWrapper}>
            <span
              className={styles.copyButton}
              onClick={handleCopyAddress}
              title="Copy address"
              tabIndex={0}
              role="button"
            >
              {address}
              <i className={buildClassName(styles.iconCopy, 'icon-copy')} aria-hidden />
            </span>
            <a
              href={tonscanAddressUrl}
              className={styles.copyButton}
              title="View address on TON Explorer"
              target="_blank"
              rel="noreferrer noopener"
            >
              <i className={buildClassName(styles.iconCopy, 'icon-tonscan')} aria-hidden />
            </a>
          </div>

          <div className={styles.buttons}>
            <Button className={styles.qrButton} onClick={openQrModal}>
              <i className={buildClassName('icon-qrcode', styles.qrIcon)} aria-hidden />
            </Button>
            <Button onClick={openInvoiceModal}>Create Invoice</Button>
          </div>
        </div>
      </Modal>
    );
  }

  function renderQr() {
    return (
      <Modal
        isSlideUp
        hasCloseButton
        noBackdrop
        title="QR-code"
        isOpen={isQrModalOpen}
        onClose={handleClose}
      >
        <div className={buildClassName(modalStyles.transitionContent, styles.content, styles.contentQr)}>
          <div className={styles.qrCode} ref={qrCodeRef} />
          <p className={buildClassName(styles.info, styles.info_small)}>{address && shortenAddress(address)}</p>

          <div className={styles.buttons}>
            <Button onClick={closeQrModal}>
              Back
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  function renderInvoice() {
    const invoiceAmount = amount ? humanToBigStr(amount) : undefined;
    const invoiceUrl = TonWeb.utils.formatTransferUrl(address!, invoiceAmount, comment);
    return (
      <Modal
        isSlideUp
        hasCloseButton
        noBackdrop
        title="Create Invoice"
        isOpen={isInvoiceModalOpen}
        onClose={handleClose}
      >
        <div className={buildClassName(modalStyles.transitionContent, styles.contentInvoice)}>
          <div className={buildClassName(styles.info, styles.info_push)}>
            You can specify the amount and purpose of <br />
            the payment to save the sender some time
          </div>
          <InputNumberRich
            key="amount"
            id="amount"
            hasError={hasAmountError}
            value={amount}
            labelText="Amount"
            onInput={handleAmountInput}
          />
          <Input
            value={comment}
            onInput={setComment}
            labelText="Comment"
            placeholder="Optional"
          />

          <p className={buildClassName(styles.description, styles.description_forInvoice)}>
            Share this URL to receive TON
          </p>
          <div className={styles.copyButtonWrapper}>
            <span
              className={styles.copyButton}
              onClick={handleCopyInvoiceLink}
              title="Copy url"
              tabIndex={0}
              role="button"
            >
              {invoiceUrl}
              <i className={buildClassName(styles.iconCopy, 'icon-copy')} aria-hidden />
            </span>
          </div>

          <div className={styles.buttons}>
            <Button onClick={closeInvoiceModal}>Back</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <>
      {renderReceive()}
      {renderQr()}
      {renderInvoice()}
    </>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  return {
    address: global.addresses?.byAccountId['0']!,
  };
})(Receive));

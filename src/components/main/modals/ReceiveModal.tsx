import QrCodeStyling from 'qr-code-styling';
import TonWeb from 'tonweb';
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { UserToken } from '../../../global/types';

import { TON_TOKEN_SLUG } from '../../../config';
import { ASSET_LOGO_PATHS } from '../../ui/helpers/assetLogos';
import renderText from '../../../global/helpers/renderText';
import { selectAccount, selectCurrentAccountTokens } from '../../../global/selectors';
import { humanToBigStr } from '../../../global/helpers';
import { shortenAddress } from '../../../util/shortenAddress';
import buildClassName from '../../../util/buildClassName';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';

import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import DropDown, { DropDownItem } from '../../ui/DropDown';
import Input from '../../ui/Input';
import InputNumberRich from '../../ui/InputNumberRich';
import InteractiveTextValue from '../../ui/InteractiveTextValue';

import modalStyles from '../../ui/Modal.module.scss';
import styles from './ReceiveModal.module.scss';

interface StateProps {
  address?: string;
  tokens?: UserToken[];
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

function ReceiveModal({
  isOpen,
  address,
  tokens,
  onClose,
}: StateProps & OwnProps) {
  // eslint-disable-next-line no-null/no-null
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const lang = useLang();
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [comment, setComment] = useState<string>('');
  const [hasAmountError, setHasAmountError] = useState<boolean>(false);
  const [isQrModalOpen, openQrModal, closeQrModal] = useFlag(false);
  const [isInvoiceModalOpen, openInvoiceModal, closeInvoiceModal] = useFlag(false);

  const dropDownItems = useMemo(() => {
    if (!tokens) {
      return [];
    }

    return tokens.reduce<DropDownItem[]>((acc, token) => {
      if (token.slug === TON_TOKEN_SLUG) {
        acc.push({
          value: token.slug,
          icon: token.image || ASSET_LOGO_PATHS[token.symbol.toLowerCase() as keyof typeof ASSET_LOGO_PATHS],
          name: token.symbol,
        });
      }

      return acc;
    }, []);
  }, [tokens]);

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

  const handleClose = useCallback(() => {
    onClose();
    closeInvoiceModal();
    closeQrModal();
  }, [closeInvoiceModal, closeQrModal, onClose]);

  function renderTokens() {
    return (
      <DropDown
        items={dropDownItems}
        selectedValue={TON_TOKEN_SLUG}
        className={styles.tokenDropDown}
      />
    );
  }

  function renderReceive() {
    return (
      <Modal
        isSlideUp
        hasCloseButton
        title={lang('Receive TON')}
        isOpen={isOpen}
        onClose={handleClose}
      >
        <div className={modalStyles.transitionContent}>
          <div className={styles.info}>
            {renderText(lang('$receive_ton_description'))}
          </div>

          <p className={styles.description}>{lang('Your address')}</p>
          <InteractiveTextValue
            address={address!}
            copyNotification={lang('Your address was copied!')}
            noSavedAddress
          />

          <div className={styles.buttons}>
            <Button className={styles.qrButton} onClick={openQrModal} ariaLabel={lang('Show QR-Code')}>
              <i className={buildClassName('icon-qrcode', styles.qrIcon)} aria-hidden />
            </Button>
            <Button onClick={openInvoiceModal}>{lang('Create Invoice')}</Button>
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
        title={lang('QR-code')}
        isOpen={isQrModalOpen}
        onClose={handleClose}
      >
        <div className={buildClassName(modalStyles.transitionContent, styles.content, styles.contentQr)}>
          <div className={styles.qrCode} ref={qrCodeRef} />
          <p className={buildClassName(styles.info, styles.info_small)}>{address && shortenAddress(address)}</p>

          <div className={styles.buttons}>
            <Button onClick={closeQrModal}>{lang('Back')}</Button>
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
        title={lang('Create Invoice')}
        isOpen={isInvoiceModalOpen}
        onClose={handleClose}
      >
        <div className={buildClassName(modalStyles.transitionContent, styles.contentInvoice)}>
          <div className={buildClassName(styles.info, styles.info_push)}>
            {renderText(lang('$receive_invoice_description'))}
          </div>
          <InputNumberRich
            key="amount"
            id="amount"
            hasError={hasAmountError}
            value={amount}
            labelText={lang('Amount')}
            onInput={handleAmountInput}
          >
            {renderTokens()}
          </InputNumberRich>
          <Input
            value={comment}
            onInput={setComment}
            labelText={lang('Comment')}
            placeholder={lang('Optional')}
          />

          <p className={buildClassName(styles.description, styles.description_forInvoice)}>
            {lang('Share this URL to receive TON')}
          </p>
          <InteractiveTextValue
            text={invoiceUrl}
            copyNotification={lang('Invoice link was copied!')}
          />

          <div className={styles.buttons}>
            <Button onClick={closeInvoiceModal}>{lang('Back')}</Button>
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
  const address = selectAccount(global, global.currentAccountId!)?.address;

  return {
    address,
    tokens: selectCurrentAccountTokens(global),
  };
})(ReceiveModal));

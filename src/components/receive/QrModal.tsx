import QrCodeStyling from 'qr-code-styling';
import React, { memo, useEffect, useRef } from '../../lib/teact/teact';

import { withGlobal } from '../../global';
import { selectAccount } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { shortenAddress } from '../../util/shortenAddress';
import formatTransferUrl from '../../util/ton/formatTransferUrl';

import useLang from '../../hooks/useLang';

import Button from '../ui/Button';
import Modal from '../ui/Modal';

import styles from './ReceiveModal.module.scss';

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

type StateProps = {
  address?: string;
};

type OwnProps = {
  backButtonText?: string;
  isOpen: boolean;
  onBackButtonClick: () => void;
  onClose: () => void;
};

function QrModal({
  address, backButtonText, isOpen, onBackButtonClick, onClose,
}: StateProps & OwnProps) {
  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const qrCodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      QR_CODE.append(qrCodeRef.current || undefined);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!address) {
      return;
    }
    QR_CODE.update({ data: formatTransferUrl(address) });
  }, [address]);

  return (
    <Modal hasCloseButton title={lang('QR-code')} isOpen={isOpen} onClose={onClose}>
      <div className={buildClassName(styles.content, styles.contentQr)}>
        <div className={styles.qrCode} ref={qrCodeRef} />
        <p className={buildClassName(styles.info, styles.info_small)}>{address && shortenAddress(address)}</p>

        <div className={styles.buttons}>
          <Button onClick={onBackButtonClick}>{backButtonText ?? lang('Back')}</Button>
        </div>
      </div>
    </Modal>
  );
}

export default memo(
  withGlobal<OwnProps>((global): StateProps => {
    const address = selectAccount(global, global.currentAccountId!)?.address;

    return {
      address,
    };
  })(QrModal),
);

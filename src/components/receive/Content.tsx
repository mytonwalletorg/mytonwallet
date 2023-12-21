import type QRCodeStyling from 'qr-code-styling/lib/core/QRCodeStyling';
import React, { memo, useEffect, useRef } from '../../lib/teact/teact';
import { removeExtraClass } from '../../lib/teact/teact-dom';
import { getActions, withGlobal } from '../../global';

import { requestMutation } from '../../lib/fasterdom/fasterdom';
import renderText from '../../global/helpers/renderText';
import { selectAccount } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import formatTransferUrl from '../../util/ton/formatTransferUrl';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Button from '../ui/Button';
import InteractiveTextField from '../ui/InteractiveTextField';

import modalStyles from '../ui/Modal.module.scss';
import styles from './ReceiveModal.module.scss';

interface StateProps {
  address?: string;
  isLedger?: boolean;
}

type OwnProps = {
  isOpen: boolean;
  isStatic?: boolean;
  onInvoiceModalOpen: NoneToVoidFunction;
};

const QR_SIZE = 600;
let qrCode: QRCodeStyling;

function Content({
  isOpen, address, isStatic, onInvoiceModalOpen, isLedger,
}: StateProps & OwnProps) {
  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const [isInitialized, markAsInitialized] = useFlag(false);

  useEffect(() => {
    if (isInitialized) return;

    initializeQrCode(markAsInitialized);
  }, [isInitialized]);

  useEffect(() => {
    if (!isOpen || !isInitialized) return;

    requestMutation(() => {
      if (qrCodeRef.current) removeExtraClass(qrCodeRef.current, styles.qrCodeHidden);
    });

    qrCode.append(qrCodeRef.current || undefined);
  }, [isInitialized, isOpen]);

  useEffect(() => {
    if (!address || !qrCode || !isOpen || !isInitialized) {
      return;
    }

    qrCode.update({ data: formatTransferUrl(address) });
  }, [address, isInitialized, isOpen]);

  const { verifyHardwareAddress } = getActions();

  const handleVerify = useLastCallback(() => {
    verifyHardwareAddress();
  });

  return (
    <>
      <div className={styles.contentTitle}>
        {renderText(lang('$receive_ton_description'))}
      </div>

      <p className={styles.label}>{lang('Your address')}</p>
      <InteractiveTextField
        address={address!}
        className={isStatic ? styles.copyButtonStatic : undefined}
        copyNotification={lang('Your address was copied!')}
        noSavedAddress
      />

      <div className={buildClassName(styles.qrCode, !qrCode && styles.qrCodeHidden)} ref={qrCodeRef} />

      {isLedger && (
        <div className={buildClassName(styles.contentTitle, styles.c)}>
          {renderText(lang('$ledger_verify_address'))}
          {' '}
          <a href="#" onClick={handleVerify} className={styles.dottedLink}>
            {lang('Verify now')}
          </a>
        </div>
      )}

      <div className={modalStyles.buttons}>
        <Button onClick={onInvoiceModalOpen} className={styles.invoiceButton}>
          {lang('Create Deposit Link')}
        </Button>
      </div>
    </>
  );
}

export default memo(
  withGlobal<OwnProps>((global): StateProps => {
    const account = selectAccount(global, global.currentAccountId!);

    return {
      address: account?.address,
      isLedger: Boolean(account?.ledger),
    };
  })(Content),
);

function initializeQrCode(cb: NoneToVoidFunction) {
  import('qr-code-styling')
    .then(({ default: QrCodeStyling }) => {
      qrCode = new QrCodeStyling({
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
        data: formatTransferUrl(''),
      });

      cb();
    });
}

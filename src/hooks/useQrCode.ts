import type QRCodeStyling from 'qr-code-styling';
import {
  useEffect, useLayoutEffect, useRef, useState,
} from '../lib/teact/teact';
import { removeExtraClass } from '../lib/teact/teact-dom';

import formatTransferUrl from '../util/ton/formatTransferUrl';

const QR_SIZE = 600;

interface UseQRCodeHook {
  qrCodeRef: React.RefObject<HTMLDivElement>;
  isInitialized: boolean;
}

let qrCode: QRCodeStyling;

export default function useQrCode(
  address?: string,
  isOpen?: boolean,
  hiddenClassName?: string,
  hideLogo?: boolean,
  withFormatTransferUrl?: boolean,
): UseQRCodeHook {
  const [isInitialized, setIsInitialized] = useState(!!qrCode);

  // eslint-disable-next-line no-null/no-null
  const qrCodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isInitialized) return;

    import('qr-code-styling')
      .then(({ default: QrCodeStyling }) => {
        qrCode = new QrCodeStyling({
          width: QR_SIZE,
          height: QR_SIZE,
          image: './logo.svg',
          margin: 0,
          type: 'canvas',
          dotsOptions: { type: 'rounded' },
          cornersSquareOptions: { type: 'extra-rounded' },
          imageOptions: { imageSize: 0.4, margin: 8, crossOrigin: 'anonymous' },
          qrOptions: { errorCorrectionLevel: 'M' },
          data: formatTransferUrl(''),
        });

        setIsInitialized(true);
      });
  }, [isInitialized]);

  useLayoutEffect(() => {
    if (!isOpen || !isInitialized) return;

    if (qrCodeRef.current && hiddenClassName) removeExtraClass(qrCodeRef.current, hiddenClassName);

    if (qrCodeRef.current) {
      qrCode?.append(qrCodeRef.current);
      // eslint-disable-next-line no-underscore-dangle
      qrCode._options.image = hideLogo ? undefined : './logo.svg';
    }
  }, [isOpen, isInitialized, hiddenClassName, hideLogo]);

  useEffect(() => {
    if (!address || !isOpen || !qrCode || !isInitialized) return;

    qrCode.update({ data: withFormatTransferUrl ? formatTransferUrl(address) : address });
  }, [address, isOpen, isInitialized, withFormatTransferUrl]);

  return { qrCodeRef, isInitialized };
}

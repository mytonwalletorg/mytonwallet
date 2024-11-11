import type QRCodeStyling from 'qr-code-styling';
import {
  useEffect, useLayoutEffect, useRef, useState,
} from '../lib/teact/teact';
import { removeExtraClass } from '../lib/teact/teact-dom';

import type { ApiChain } from '../api/types';

import getChainNetworkIcon from '../util/swap/getChainNetworkIcon';
import formatTransferUrl from '../util/ton/formatTransferUrl';

const QR_SIZE = 600;

interface UseQRCodeHook {
  qrCodeRef: React.RefObject<HTMLDivElement>;
  isInitialized: boolean;
}

let qrCode: QRCodeStyling;

export default function useQrCode({
  address,
  chain,
  isActive,
  hiddenClassName,
  hideLogo,
  withFormatTransferUrl,
}: {
  address?: string;
  chain?: ApiChain;
  isActive?: boolean;
  hiddenClassName?: string;
  hideLogo?: boolean;
  withFormatTransferUrl?: boolean;
}): UseQRCodeHook {
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
          image: chain ? getChainNetworkIcon(chain) : './logo.svg',
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
  }, [chain, isInitialized]);

  useLayoutEffect(() => {
    if (!isActive || !isInitialized) return;

    if (qrCodeRef.current && hiddenClassName) removeExtraClass(qrCodeRef.current, hiddenClassName);

    if (qrCodeRef.current) {
      qrCode?.append(qrCodeRef.current);
      // eslint-disable-next-line no-underscore-dangle
      qrCode._options.image = hideLogo
        ? undefined
        : (chain ? getChainNetworkIcon(chain) : './logo.svg');
    }
  }, [isActive, isInitialized, hiddenClassName, hideLogo, chain]);

  useEffect(() => {
    if (!address || !isActive || !qrCode || !isInitialized) return;

    qrCode.update({ data: withFormatTransferUrl ? formatTransferUrl(address) : address });
  }, [address, isActive, isInitialized, withFormatTransferUrl]);

  return { qrCodeRef, isInitialized };
}

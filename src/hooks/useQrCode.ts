import type QRCodeStyling from 'qr-code-styling';
import {
  type ElementRef,
  useEffect, useLayoutEffect, useRef, useState,
} from '../lib/teact/teact';
import { removeExtraClass } from '../lib/teact/teact-dom';

import type { ApiChain } from '../api/types';

import { IS_CORE_WALLET } from '../config';
import getChainNetworkIcon from '../util/swap/getChainNetworkIcon';
import formatTransferUrl from '../util/ton/formatTransferUrl';

const QR_SIZE = 600;

interface UseQRCodeHook {
  qrCodeRef: ElementRef<HTMLDivElement>;
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
  const logoUrl = IS_CORE_WALLET ? './coreWallet/logo.svg' : './logo.svg';

  const qrCodeRef = useRef<HTMLDivElement>();

  useEffect(() => {
    if (isInitialized) return;

    void import('qr-code-styling')
      .then(({ default: QrCodeStyling }) => {
        qrCode = new QrCodeStyling({
          width: QR_SIZE,
          height: QR_SIZE,
          image: chain ? getChainNetworkIcon(chain) : logoUrl,
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
  }, [chain, isInitialized, logoUrl]);

  useLayoutEffect(() => {
    if (!isActive || !isInitialized) return;

    if (qrCodeRef.current && hiddenClassName) removeExtraClass(qrCodeRef.current, hiddenClassName);

    if (qrCodeRef.current) {
      qrCode?.append(qrCodeRef.current);

      qrCode._options.image = hideLogo
        ? undefined
        : (chain ? getChainNetworkIcon(chain) : logoUrl);
    }
  }, [isActive, isInitialized, hiddenClassName, hideLogo, chain, logoUrl]);

  useEffect(() => {
    if (!address || !isActive || !qrCode || !isInitialized) return;

    qrCode.update({ data: withFormatTransferUrl ? formatTransferUrl(address) : address });
  }, [address, isActive, isInitialized, withFormatTransferUrl]);

  return { qrCodeRef, isInitialized };
}

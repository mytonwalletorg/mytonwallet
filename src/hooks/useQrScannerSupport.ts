import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

import { IS_CAPACITOR } from '../config';
import useEffectOnce from './useEffectOnce';

let isQrScannerSupported = false;

export default function useQrScannerSupport() {
  useEffectOnce(() => {
    if (!IS_CAPACITOR || isQrScannerSupported) return;

    BarcodeScanner
      .isSupported()
      .then((result) => {
        isQrScannerSupported = result.supported;
      });
  });

  return isQrScannerSupported;
}

import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

import { IS_CAPACITOR } from '../config';
import useEffectOnce from './useEffectOnce';
import useForceUpdate from './useForceUpdate';

let isQrScannerSupported = false;

export default function useQrScannerSupport() {
  const forceUpdate = useForceUpdate();

  useEffectOnce(() => {
    if (!IS_CAPACITOR || isQrScannerSupported) return;

    BarcodeScanner
      .isSupported()
      .then((result) => {
        isQrScannerSupported = result.supported;
        forceUpdate();
      });
  });

  return isQrScannerSupported;
}

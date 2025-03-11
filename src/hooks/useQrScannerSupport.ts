import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

import { IS_CAPACITOR } from '../config';
import { getIsMobileTelegramApp } from '../util/windowEnvironment';
import useEffectOnce from './useEffectOnce';
import useForceUpdate from './useForceUpdate';

let isQrScannerSupported = getIsMobileTelegramApp();

export default function useQrScannerSupport() {
  const forceUpdate = useForceUpdate();

  useEffectOnce(() => {
    if (!IS_CAPACITOR || isQrScannerSupported) return;

    void BarcodeScanner
      .isSupported()
      .then((result) => {
        isQrScannerSupported = result.supported;
        forceUpdate();
      });
  });

  return isQrScannerSupported;
}

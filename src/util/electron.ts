import { ElectronEvent } from '../electron/types';

import { callApi } from '../api';
import { tonConnectGetDeviceInfo } from './tonConnectEnvironment';

export function initElectron() {
  window.electron?.on(ElectronEvent.DEEPLINK_TONCONNECT, async (params: { url: string }) => {
    const deviceInfo = tonConnectGetDeviceInfo();
    const returnUrl = await callApi('startSseConnection', params.url, deviceInfo);

    if (returnUrl) {
      window.open(returnUrl, '_blank');
    }
  });
}

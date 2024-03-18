import { ElectronEvent } from '../electron/types';

import { processTonConnectDeeplink, processTonDeeplink } from './deeplink';

export function initElectron() {
  window.electron?.on(ElectronEvent.DEEPLINK, ({ url }: { url: string }) => {
    void processTonDeeplink(url);
  });

  window.electron?.on(ElectronEvent.DEEPLINK_TONCONNECT, (params: { url: string }) => {
    void processTonConnectDeeplink(params.url, electronOpenUrl);
  });
}

export function electronOpenUrl(url: string) {
  window.open(url, '_blank');
}

import { PROXY } from '../../config';
import { Storage } from '../storages/types';
import { updateDapps } from '../dappMethods';

// eslint-disable-next-line no-restricted-globals
export const IS_EXTENSION = Boolean(self?.chrome?.runtime?.id);

// eslint-disable-next-line max-len
const PROXY_PAC_SCRIPT = `function FindProxyForURL(url, host) { return host.endsWith('.ton') || host.endsWith('.adnl') ? 'PROXY ${PROXY}' : 'DIRECT'; }`;

let storage: Storage;

export async function initExtension(_storage: Storage) {
  if (!IS_EXTENSION) {
    return;
  }

  storage = _storage;

  const isTonProxyEnabled = await storage.getItem('isTonProxyEnabled');
  doProxy(isTonProxyEnabled);
}

export function doProxy(isEnabled: boolean) {
  if (!PROXY) {
    return;
  }

  void storage.setItem('isTonProxyEnabled', isEnabled);
  chrome.proxy.settings.set({
    scope: 'regular',
    value: isEnabled ? {
      mode: 'pac_script',
      pacScript: {
        data: PROXY_PAC_SCRIPT,
      },
    } : {
      mode: 'direct',
    },
  });
}

export function doMagic(isEnabled: boolean) {
  void storage.setItem('isTonMagicEnabled', isEnabled);

  updateDapps({
    type: 'updateTonMagic',
    isEnabled,
  });
}

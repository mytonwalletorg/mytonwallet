import { PROXY_HOSTS } from '../../config';
import { sample } from '../../util/random';
import { IS_EXTENSION } from '../environment';
import { Storage } from '../storages/types';
import { updateDapps } from '../dappMethods';

const proxyHost = PROXY_HOSTS ? sample(PROXY_HOSTS.split(' ')) : '';

// eslint-disable-next-line max-len
const PROXY_PAC_SCRIPT = `function FindProxyForURL(url, host) { return host.endsWith('.ton') || host.endsWith('.adnl') ? 'PROXY ${proxyHost}' : 'DIRECT'; }`;

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
  if (!PROXY_HOSTS) {
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

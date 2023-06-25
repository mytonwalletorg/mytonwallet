import type { Storage } from '../storages/types';
import type { OnApiUpdate } from '../types';

import { PROXY_HOSTS } from '../../config';
import { sample } from '../../util/random';
import { updateDapps } from '../dappMethods';
import { IS_EXTENSION } from '../environment';

const proxyHost = PROXY_HOSTS ? sample(PROXY_HOSTS.split(' ')) : '';

// eslint-disable-next-line max-len
const PROXY_PAC_SCRIPT = `function FindProxyForURL(url, host) { return host.endsWith('.ton') || host.endsWith('.adnl') || host.endsWith('.bag') ? 'PROXY ${proxyHost}' : 'DIRECT'; }`;

let storage: Storage;
let onUpdate: OnApiUpdate;
let isProxyEnabled = false;

export async function initExtension(_onUpdate: OnApiUpdate, _storage: Storage) {
  if (!IS_EXTENSION) {
    return;
  }

  storage = _storage;
  onUpdate = _onUpdate;

  const isTonProxyEnabled = await storage.getItem('isTonProxyEnabled');
  doProxy(isTonProxyEnabled);

  const isDeeplinkHookEnabled = await storage.getItem('isDeeplinkHookEnabled');
  doDeeplinkHook(isDeeplinkHookEnabled);
}

export function setupDefaultExtensionFeatures() {
  doDeeplinkHook(true);
  onUpdate({
    type: 'updateDeeplinkHookState',
    isEnabled: Boolean(true),
  });
}

export async function clearExtensionFeatures() {
  doProxy(false);
  doMagic(false);
  doDeeplinkHook(false);

  await Promise.all([
    storage.removeItem('isTonMagicEnabled'),
    storage.removeItem('isTonProxyEnabled'),
    storage.removeItem('isDeeplinkHookEnabled'),
    storage.removeItem('dapps'),
  ]);
}

export function doProxy(isEnabled: boolean) {
  if (!PROXY_HOSTS) {
    return;
  }

  if (isProxyEnabled === isEnabled) {
    return;
  }

  isProxyEnabled = isEnabled;
  void storage.setItem('isTonProxyEnabled', isEnabled);

  if (isEnabled) {
    chrome.proxy.settings.set({
      scope: 'regular',
      value: {
        mode: 'pac_script',
        pacScript: {
          data: PROXY_PAC_SCRIPT,
        },
      },
    });
  } else {
    chrome.proxy.settings.clear({
      scope: 'regular',
    });
  }
}

export function doMagic(isEnabled: boolean) {
  void storage.setItem('isTonMagicEnabled', isEnabled);

  updateDapps({
    type: 'updateTonMagic',
    isEnabled,
  });
}

export function doDeeplinkHook(isEnabled: boolean) {
  void storage.setItem('isDeeplinkHookEnabled', isEnabled);

  updateDapps({
    type: 'updateDeeplinkHook',
    isEnabled,
  });
}

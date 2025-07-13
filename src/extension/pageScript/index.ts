import type { ApiSiteUpdate } from '../../api/types/dappUpdates';

import { callApi, initApi } from '../../api/providers/extension/connectorForPageScript';
import { doDeeplinkHook } from './deeplinkHook';
import { doTonMagic } from './tonMagic';

import { initTonConnect } from './TonConnect';
import { initTonProvider } from './TonProvider';

const siteOrigin = window.origin;
const apiConnector = initApi(onUpdate);
const tonProvider = initTonProvider(apiConnector);
const tonConnect = initTonConnect(apiConnector);

function onUpdate(update: ApiSiteUpdate) {
  const { type, ...args } = update;

  if (type === 'updateTonMagic') {
    const { isEnabled } = update;
    void doTonMagic(isEnabled, async () => {
      await callApi('flushMemoryCache');
      window.location.reload();
    });
    return;
  }

  if (type === 'updateDeeplinkHook') {
    const { isEnabled } = update;
    doDeeplinkHook(isEnabled);
    return;
  }

  if (type === 'disconnectSite') {
    const { url } = update;
    if (url === siteOrigin) {
      tonConnect.onDisconnect();
    }
  }

  // <legacy>
  if (type === 'updateAccounts') {
    const { accounts } = update;
    tonProvider.emit('accountsChanged', accounts);
    return;
  }

  tonProvider.emit(type, args);
  // </legacy>
}

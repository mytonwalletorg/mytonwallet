import { ApiDappUpdate } from '../../api/types/dappUpdates';
import { initApi, callApi } from '../../api/providers/extension/connectorForPageScript';

import { initTonConnect } from './TonConnect';
import { initTonProvider } from './TonProvider';
import { doTonMagic } from './tonMagic';
import { doDeeplinkHook } from './deeplinkHook';

const apiConnector = initApi(onUpdate);
const tonProvider = initTonProvider(apiConnector);
initTonConnect(apiConnector);

function onUpdate(update: ApiDappUpdate) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // <legacy>
  if (type === 'updateAccounts') {
    const { accounts } = update;
    tonProvider.emit('accountsChanged', accounts);
    return;
  }

  tonProvider.emit(type, args);
  // </legacy>
}

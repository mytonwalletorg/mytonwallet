import { TonConnect } from './provider/TonConnect';
import { initTonProvider } from './provider/TonProvider';
import { ApiDappUpdate } from '../api/types/dappUpdates';
import { doTonMagic } from './provider/tonMagic';
import { createConnector } from '../util/PostMessageConnector';
import { PROVIDER_CHANNEL } from './config';

declare global {
  interface Window {
    mytonwallet: {
      tonconnect: TonConnect;
    };
  }
}

const connector = createConnector(window, onUpdate, PROVIDER_CHANNEL, window.location.href);
const tonProvider = initTonProvider(connector);
const tonConnect = new TonConnect(connector);

function onUpdate(update: ApiDappUpdate) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { type, ...args } = update;

  if (type === 'updateTonMagic') {
    const { isEnabled } = update;
    const cb = async () => {
      await connector.request({ name: 'flushMemoryCache', args: [] });
      window.location.reload();
    };

    void doTonMagic(isEnabled, cb);
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

window.mytonwallet = {
  tonconnect: tonConnect,
};

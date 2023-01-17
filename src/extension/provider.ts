import { EventEmitter } from '../util/callbacks';
import { Connector, createConnector } from '../util/PostMessageConnector';
import { PROVIDER_CHANNEL } from './config';
import { ApiDappUpdate } from '../api/types/dappUpdates';
import { doTonMagic } from './provider/tonMagic';

declare global {
  interface Window {
    tonProtocolVersion: 1;
    ton: Provider;
    myTonWallet: Provider;
  }
}

type Methods =
  'ton_getBalance'
  | 'ton_requestAccounts'
  | 'ton_requestWallets'
  | 'ton_sendTransaction'
  | 'ton_rawSign'
  | 'flushMemoryCache';

class Provider extends EventEmitter {
  public isMyTonWallet = true;

  public isTonWallet = true; // Native extension legacy requirement

  private connector: Connector;

  constructor() {
    super();

    this.connector = createConnector(window, this.onUpdate, PROVIDER_CHANNEL, window.location.href);
  }

  destroy() {
    this.connector.destroy();
  }

  // Prefixes is the native extension legacy requirement
  send(prefixedName: Methods, args = []) {
    const name = prefixedName.replace('ton_', '');
    return this.connector.request({ name, args });
  }

  private onUpdate = (update: ApiDappUpdate) => {
    const { type, ...args } = update;

    if (type === 'updateAccounts') {
      const { accounts } = update;
      this.emit('accountsChanged', accounts);

      return;
    }

    if (type === 'updateTonMagic') {
      const { isEnabled } = update;
      const cb = async () => {
        await this.send('flushMemoryCache');
        window.location.reload();
      };

      void doTonMagic(isEnabled, cb);
      return;
    }

    this.emit(type, args);

    // TODO Implement:
    // this.emit('notification', result);
    // this.emit('connect');
    // this.emit('close', code, reason);
  };
}

if (window.ton) {
  try {
    window.ton.destroy();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log(err);
  }
}

window.tonProtocolVersion = 1;
const provider = new Provider();
window.ton = provider;
window.myTonWallet = provider;
window.dispatchEvent(new Event('tonready'));

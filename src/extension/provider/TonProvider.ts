import { EventEmitter } from '../../util/callbacks';
import { Connector, createConnector } from '../../util/PostMessageConnector';
import { PROVIDER_CHANNEL } from '../config';
import { ApiDappUpdate } from '../../api/types/dappUpdates';
import { doTonMagic } from './tonMagic';

type Methods =
  'ton_getBalance'
  | 'ton_requestAccounts'
  | 'ton_requestWallets'
  | 'ton_sendTransaction'
  | 'ton_rawSign'
  | 'flushMemoryCache'
  | 'tonConnect_connect'
  | 'tonConnect_reconnect'
  | 'tonConnect_disconnect'
  | 'tonConnect_sendTransaction';

export class TonProvider extends EventEmitter {
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
  send(prefixedName: Methods, args: any[] = []) {
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

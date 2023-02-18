import { EventEmitter } from '../../util/callbacks';
import { Connector } from '../../util/PostMessageConnector';

declare global {
  interface Window {
    tonProtocolVersion: 1;
    ton: TonProvider;
    myTonWallet: TonProvider;
  }
}

type Methods =
  'ton_getBalance'
  | 'ton_requestAccounts'
  | 'ton_requestWallets'
  | 'ton_sendTransaction'
  | 'ton_rawSign';

export class TonProvider extends EventEmitter {
  public isMyTonWallet = true;

  public isTonWallet = true; // Native extension legacy requirement

  private connector: Connector;

  constructor(connector: Connector) {
    super();

    this.connector = connector;
  }

  destroy() {
    this.connector.destroy();
  }

  // Prefixes is the native extension legacy requirement
  send(name: Methods, args: any[] = []) {
    return this.connector.request({ name, args });
  }
}

export function initTonProvider(connector: Connector) {
  const tonProvider = new TonProvider(connector);

  if (window.ton) {
    try {
      window.ton.destroy();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
    }
  }

  window.tonProtocolVersion = 1;
  window.ton = tonProvider;
  window.myTonWallet = tonProvider;
  window.dispatchEvent(new Event('tonready'));

  return tonProvider;
}

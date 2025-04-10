import type { Connector } from '../../util/PostMessageConnector';

import { IS_CORE_WALLET } from '../../config';
import { EventEmitter } from '../../util/callbacks';

declare global {
  interface Window {
    tonProtocolVersion: 1;
    ton: TonProvider;
    myTonWallet: TonProvider;
    tonWallet: TonProvider;
  }
}

type Methods =
  'ton_getBalance'
  | 'ton_requestAccounts'
  | 'ton_requestWallets'
  | 'ton_sendTransaction'
  | 'ton_rawSign';

export class TonProvider extends EventEmitter {
  public isMyTonWallet = !IS_CORE_WALLET;

  public isTonWallet = true; // Native extension legacy requirement

  constructor(private apiConnector: Connector | undefined) {
    super();
  }

  destroy() {
    //  Because a user can install the MyTonWallet and CoreWallet extensions at the same time, there may be a conflict
    //  when destroying the Connector instance. Therefore, we simply delete the reference to the Connector.
    this.apiConnector = undefined;
  }

  // Prefixes is the native extension legacy requirement
  send(name: Methods, args: any[] = []) {
    return this.apiConnector?.request({ name, args });
  }
}

export function initTonProvider(apiConnector: Connector) {
  const tonProvider = new TonProvider(apiConnector);

  // Custom provider for applications that want to work specifically with MyTonWallet
  if (!IS_CORE_WALLET) {
    window.myTonWallet = tonProvider;
  }

  // Set window.ton only if:
  // 1. It doesn't exist yet, or
  // 2. It is a CoreWallet (which has priority)
  let shouldInjectProvider = true;
  if (window.ton) {
    try {
      if (IS_CORE_WALLET) {
        window.ton.destroy();
      } else {
        shouldInjectProvider = false;
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
    }
  }

  window.tonProtocolVersion = 1;
  if (shouldInjectProvider) {
    window.ton = tonProvider;
  }

  window.dispatchEvent(new Event('tonready'));

  return tonProvider;
}

import { TonConnect } from './provider/TonConnect';
import { TonProvider } from './provider/TonProvider';

declare global {
  interface Window {
    tonProtocolVersion: 1;
    ton: TonProvider;
    myTonWallet: TonProvider;
    mytonwallet: {
      tonconnect: TonConnect;
    };
  }
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
const provider = new TonProvider();
window.ton = provider;
window.myTonWallet = provider;
window.dispatchEvent(new Event('tonready'));

window.mytonwallet = {
  tonconnect: new TonConnect(provider),
};

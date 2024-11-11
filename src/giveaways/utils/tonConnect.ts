import { Address } from '@ton/core';
import type { Wallet, WalletInfoRemote } from '@tonconnect/sdk';
import TonConnect, { isWalletInfoCurrentlyEmbedded } from '@tonconnect/sdk';

import { DEBUG } from '../../config';
import { shortenAddress } from '../../util/shortenAddress';

import useLastCallback from '../../hooks/useLastCallback';

const TON_PROOF_PAYLOAD = 'MyTonWallet';
const MANIFEST_URL = 'https://checkin.mytonwallet.org/tonconnect-manifest.json';
const PRETTIFY_SYMBOL_COUNT = 6;

export const tonConnect = new TonConnect({ manifestUrl: MANIFEST_URL });

declare global {
  interface Window {
    disconnect?: () => void;
  }
}

if (DEBUG) {
  window.disconnect = () => tonConnect.disconnect();
}

export function useLoadWallet(setWallet: (wallet: Wallet) => void) {
  return useLastCallback(() => tonConnect.onStatusChange((walletChanged) => {
    if (walletChanged) {
      setWallet(walletChanged);
    }
  }));
}

export function prettifyAddress(address: string) {
  const unbounceableAddress = Address.parse(address).toString({ bounceable: false });
  return shortenAddress(unbounceableAddress, PRETTIFY_SYMBOL_COUNT);
}

export function connectEmbeddedWalletOrGetUrl(connector: TonConnect, walletInfo: WalletInfoRemote) {
  const connectorOptions = {
    request: { tonProof: TON_PROOF_PAYLOAD },
  };

  if (isWalletInfoCurrentlyEmbedded(walletInfo)) {
    return connector.connect({
      jsBridgeKey: walletInfo.jsBridgeKey,
    }, connectorOptions);
  } else {
    const { bridgeUrl, universalLink } = walletInfo;
    return connector.connect({
      bridgeUrl, universalLink,
    }, connectorOptions);
  }
}

export function openWalletConnectPage(connector: TonConnect, walletInfo: WalletInfoRemote) {
  const connection = connectEmbeddedWalletOrGetUrl(connector, walletInfo);
  if (typeof connection === 'string') {
    window.open(connection, '_blank', 'noreferrer');
  }
}

export async function handleTonConnectButtonClick(mtwWalletInfo: WalletInfoRemote) {
  if (tonConnect.connected) await tonConnect.disconnect();

  openWalletConnectPage(
    tonConnect, mtwWalletInfo,
  );
}

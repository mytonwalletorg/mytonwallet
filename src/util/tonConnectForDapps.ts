import type { Wallet, WalletInfoRemote } from '@tonconnect/sdk';
import TonConnect, { isWalletInfoCurrentlyEmbedded, isWalletInfoCurrentlyInjected } from '@tonconnect/sdk';

import { DEBUG } from '../config';

interface TxMessage {
  address: string;
  amount: string;
  payload?: string;
  stateInit?: string;
}

interface SendTxOptions {
  validUntil?: number;
  messages: TxMessage[];
}

declare global {
  interface Window {
    disconnect?: () => void;
  }
}

export function createTonConnect(manifestUrl: string) {
  const tonConnect = new TonConnect({
    manifestUrl,
  });

  if (DEBUG) {
    window.disconnect = () => tonConnect.disconnect();
  }

  return tonConnect;
}

export function subscribeToWalletConnection(tonConnect: TonConnect, setWallet: (wallet?: Wallet) => void) {
  if (tonConnect.connected) {
    setWallet(tonConnect.wallet ?? undefined);
  }

  return tonConnect.onStatusChange((walletChanged) => {
    if (walletChanged) {
      setWallet(walletChanged);
    } else {
      setWallet(undefined);
    }
  });
}

export function connectEmbeddedWalletOrGetUrl(connector: TonConnect, walletInfo: WalletInfoRemote) {
  const connectorOptions = {};

  if (isWalletInfoCurrentlyEmbedded(walletInfo) || isWalletInfoCurrentlyInjected(walletInfo)) {
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

export async function handleTonConnectButtonClick(tonConnect: TonConnect, mtwWalletInfo: WalletInfoRemote) {
  if (tonConnect.connected) await tonConnect.disconnect();

  openWalletConnectPage(tonConnect, mtwWalletInfo);
}

export async function sendTransaction(tonConnect: TonConnect, options: SendTxOptions) {
  if (!tonConnect.connected) {
    throw new Error('Wallet is not connected');
  }

  const tx = {
    validUntil: options.validUntil || Math.floor(Date.now() / 1000) + 360, // Default: 5 minutes timeout
    network: tonConnect.wallet?.account.chain,
    messages: options.messages.map((msg) => ({
      address: msg.address,
      amount: msg.amount,
      payload: msg.payload,
      stateInit: msg.stateInit,
    })),
  };

  try {
    return await tonConnect.sendTransaction(tx);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to send transaction:', error);
    throw error;
  }
}

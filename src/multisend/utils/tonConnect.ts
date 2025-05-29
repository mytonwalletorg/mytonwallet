import { Address } from '@ton/core';
import type { Wallet, WalletInfoRemote } from '@tonconnect/sdk';
import TonConnect, { isWalletInfoCurrentlyEmbedded, isWalletInfoCurrentlyInjected } from '@tonconnect/sdk';

import { DEBUG } from '../config';
import { shortenAddress } from '../../util/shortenAddress';

const MANIFEST_URL = 'https://multisend.mytonwallet.io/mytonwallet-multisend-tonconnect-manifest.json';
const PRETTIFY_SYMBOL_COUNT = 6;

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

export const tonConnect = new TonConnect({
  manifestUrl: MANIFEST_URL,
});

declare global {
  interface Window {
    disconnect?: () => void;
  }
}

if (DEBUG) {
  window.disconnect = () => tonConnect.disconnect();
}

export function subscribeToWalletConnection(setWallet: (wallet?: Wallet) => void) {
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

export function prettifyAddress(address: string) {
  const unbounceableAddress = Address.parse(address).toString({ bounceable: false });
  return shortenAddress(unbounceableAddress, PRETTIFY_SYMBOL_COUNT);
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

export async function handleTonConnectButtonClick(mtwWalletInfo: WalletInfoRemote) {
  if (tonConnect.connected) await tonConnect.disconnect();

  openWalletConnectPage(
    tonConnect, mtwWalletInfo,
  );
}

export async function sendTransaction(options: SendTxOptions) {
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

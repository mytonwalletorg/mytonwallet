import { Address } from '@ton/core';
import type { Wallet, WalletInfo } from '@tonconnect/sdk';
import TonConnect from '@tonconnect/sdk';

import { DEBUG } from '../config';
import { initIframeBridgeConnector } from '../../util/embeddedDappBridge/connector/iframeConnector';
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

declare global {
  interface Window {
    disconnect?: () => void;
  }
}

if (window.parent !== window) {
  initIframeBridgeConnector();
}

export const tonConnect = new TonConnect({
  manifestUrl: MANIFEST_URL,
});

if (DEBUG) {
  window.disconnect = () => tonConnect.disconnect();
}

export function initTonConnect(
  setIsLoading: (isLoading: boolean) => void,
  setWallet: (wallet?: Wallet) => void,
) {
  tonConnect.restoreConnection()
    .then(() => {
      setWallet(tonConnect.wallet ?? undefined);
    })
    .catch((err) => {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.error('Failed to restore connection:', err);
      }
    })
    .finally(() => {
      setIsLoading(false);
    });

  if (tonConnect.connected) {
    setWallet(tonConnect.wallet ?? undefined);
  }

  return tonConnect.onStatusChange((wallet) => {
    setWallet(wallet || undefined);
  });
}

export async function handleTonConnectButtonClick(walletInfo: WalletInfo) {
  if (tonConnect.connected) {
    await tonConnect.disconnect();
  }

  const connection = tonConnect.connect(walletInfo);

  if (typeof connection === 'string') {
    window.open(connection, '_blank', 'noreferrer');
  }
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

export function prettifyAddress(address: string) {
  const unbounceableAddress = Address.parse(address).toString({ bounceable: false });
  return shortenAddress(unbounceableAddress, PRETTIFY_SYMBOL_COUNT);
}

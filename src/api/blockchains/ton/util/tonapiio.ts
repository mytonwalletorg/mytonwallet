import {
  Configuration,
  EventApi,
  JettonApi,
  NFTApi,
  RawBlockchainApi,
} from 'tonapi-sdk-js';

import type { ApiNetwork } from '../../../types';

import { logDebugError } from '../../../../util/logs';

const TONAPIIO_MAINNET_URL = process.env.TONAPIIO_MAINNET_URL || 'https://tonapi.io';
const TONAPIIO_TESTNET_URL = process.env.TONAPIIO_TESTNET_URL || 'https://testnet.tonapi.io';

const configurationMainnet = new Configuration({
  basePath: TONAPIIO_MAINNET_URL,
});
const configurationTestnet = new Configuration({
  basePath: TONAPIIO_TESTNET_URL,
});

export const tonapiioByNetwork = {
  mainnet: {
    configuration: configurationMainnet,
    eventApi: new EventApi(configurationMainnet),
    jettonApi: new JettonApi(configurationMainnet),
    blockchainApi: new RawBlockchainApi(configurationMainnet),
    nftApi: new NFTApi(configurationMainnet),
  },
  testnet: {
    configuration: configurationTestnet,
    eventApi: new EventApi(configurationTestnet),
    jettonApi: new JettonApi(configurationTestnet),
    blockchainApi: new RawBlockchainApi(configurationTestnet),
    nftApi: new NFTApi(configurationTestnet),
  },
};

export function fetchJettonBalances(network: ApiNetwork, account: string) {
  const api = tonapiioByNetwork[network].jettonApi;
  return tonapiioErrorHandler(async () => {
    return (await api.getJettonsBalances({ account } as any)).balances;
  }, []);
}

export function fetchAccountEvents(network: ApiNetwork, account: string, limit: number, beforeLt?: number) {
  const api = tonapiioByNetwork[network].eventApi;
  return tonapiioErrorHandler(async () => {
    return (await api.accountEvents({ account, limit, beforeLt })).events;
  }, []);
}

export function fetchAccountTransactions(
  network: ApiNetwork, account: string, limit: number, minLt?: number, maxLt?: number,
) {
  const api = tonapiioByNetwork[network].blockchainApi;
  return tonapiioErrorHandler(async () => {
    return (await api.getTransactions({
      account,
      limit,
      maxLt,
      minLt,
    })).transactions;
  }, []);
}

export function fetchNftItems(network: ApiNetwork, addresses: string[]) {
  const api = tonapiioByNetwork[network].nftApi;
  return tonapiioErrorHandler(async () => (await api.getNFTItems({
    addresses,
  })).nftItems, []);
}

async function tonapiioErrorHandler<T>(fn: () => Promise<T>, defaultValue: T): Promise<T> {
  try {
    return (await fn()) || defaultValue;
  } catch (err) {
    // TODO Remove when exception is fixed in tonapiio
    if (err instanceof TypeError && (
      err.message === "Cannot read properties of null (reading 'map')" // Chrome
      || err.message.includes('null is not an object') // Safari
      || err.message.includes('t.transactions is null') // Firefox
    )) {
      return defaultValue;
    }
    logDebugError('tonapiioErrorHandler', err);
    return defaultValue;
  }
}

import {
  AccountsApi,
  BlockchainApi,
  Configuration,
  NFTApi,
  ResponseError,
} from 'tonapi-sdk-js';

import type { ApiNetwork } from '../../../types';

import { logDebugError } from '../../../../util/logs';
import { API_HEADERS } from '../../../environment';

const TONAPIIO_MAINNET_URL = process.env.TONAPIIO_MAINNET_URL || 'https://tonapi.io';
const TONAPIIO_TESTNET_URL = process.env.TONAPIIO_TESTNET_URL || 'https://testnet.tonapi.io';
const MAX_LIMIT = 1000;

const configurationMainnet = new Configuration({
  basePath: TONAPIIO_MAINNET_URL,
  headers: API_HEADERS,
});
const configurationTestnet = new Configuration({
  basePath: TONAPIIO_TESTNET_URL,
  headers: API_HEADERS,
});

export const tonapiioByNetwork = {
  mainnet: {
    configuration: configurationMainnet,
    blockchainApi: new BlockchainApi(configurationMainnet),
    nftApi: new NFTApi(configurationMainnet),
    accountsApi: new AccountsApi(configurationMainnet),
  },
  testnet: {
    configuration: configurationTestnet,
    blockchainApi: new BlockchainApi(configurationTestnet),
    nftApi: new NFTApi(configurationTestnet),
    accountsApi: new AccountsApi(configurationTestnet),
  },
};

export function fetchJettonBalances(network: ApiNetwork, account: string) {
  const api = tonapiioByNetwork[network].accountsApi;
  return tonapiioErrorHandler(async () => {
    return (await api.getJettonsBalances({ accountId: account })).balances;
  }, []);
}

export function fetchNftItems(network: ApiNetwork, addresses: string[]) {
  const api = tonapiioByNetwork[network].nftApi;
  return tonapiioErrorHandler(async () => (await api.getNftItemsByAddresses({
    getAccountsRequest: { accountIds: addresses },
  })).nftItems, []);
}

export function fetchAccountNfts(network: ApiNetwork, address: string, offset?: number, limit?: number) {
  const api = tonapiioByNetwork[network].accountsApi;
  return tonapiioErrorHandler(async () => (await api.getNftItemsByOwner({
    accountId: address,
    offset: offset ?? 0,
    limit: limit ?? MAX_LIMIT,
    indirectOwnership: true,
  })).nftItems, []);
}

export function fetchAccountEvents(network: ApiNetwork, address: string, fromSec: number, limit?: number) {
  const api = tonapiioByNetwork[network].accountsApi;
  return tonapiioErrorHandler(async () => (await api.getEventsByAccount({
    accountId: address,
    limit: limit ?? MAX_LIMIT,
    startDate: fromSec,
  })).events, []);
}

async function tonapiioErrorHandler<T>(fn: () => Promise<T>, defaultValue: T): Promise<T> {
  try {
    return (await fn()) || defaultValue;
  } catch (err: any) {
    if (err instanceof ResponseError) {
      const data = await err.response.json().catch();
      if (data?.error === 'entity not found') {
        return defaultValue;
      }
    }
    logDebugError('tonapiioErrorHandler', err);
    throw err;
  }
}

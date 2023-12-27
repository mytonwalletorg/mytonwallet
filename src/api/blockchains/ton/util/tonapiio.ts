import {
  AccountsApi,
  BlockchainApi,
  Configuration,
  NFTApi,
  ResponseError,
} from 'tonapi-sdk-js';

import type { ApiNetwork } from '../../../types';

import { TONAPIIO_MAINNET_URL, TONAPIIO_TESTNET_URL } from '../../../../config';
import { logDebugError } from '../../../../util/logs';
import { getEnvironment } from '../../../environment';

const MAX_LIMIT = 1000;

let apiByNetwork: Record<ApiNetwork, {
  blockchainApi: BlockchainApi;
  nftApi: NFTApi;
  accountsApi: AccountsApi;
}> | undefined;

function getApi(network: ApiNetwork) {
  if (!apiByNetwork) {
    const headers = getEnvironment().apiHeaders;

    const configurationMainnet = new Configuration({
      basePath: TONAPIIO_MAINNET_URL,
      ...(headers && { headers }),
    });
    const configurationTestnet = new Configuration({
      basePath: TONAPIIO_TESTNET_URL,
      ...(headers && { headers }),
    });

    apiByNetwork = {
      mainnet: {
        blockchainApi: new BlockchainApi(configurationMainnet),
        nftApi: new NFTApi(configurationMainnet),
        accountsApi: new AccountsApi(configurationMainnet),
      },
      testnet: {
        blockchainApi: new BlockchainApi(configurationTestnet),
        nftApi: new NFTApi(configurationTestnet),
        accountsApi: new AccountsApi(configurationTestnet),
      },
    };
  }

  return apiByNetwork[network];
}

export function fetchJettonBalances(network: ApiNetwork, account: string) {
  const api = getApi(network).accountsApi;
  return tonapiioErrorHandler(async () => {
    return (await api.getJettonsBalances({ accountId: account })).balances;
  }, []);
}

export function fetchNftItems(network: ApiNetwork, addresses: string[]) {
  const api = getApi(network).nftApi;
  return tonapiioErrorHandler(async () => (await api.getNftItemsByAddresses({
    getAccountsRequest: { accountIds: addresses },
  })).nftItems, []);
}

export function fetchAccountNfts(network: ApiNetwork, address: string, options?: {
  collection?: string;
  offset?: number;
  limit?: number;
}) {
  const { collection, offset, limit } = options ?? {};
  const api = getApi(network).accountsApi;

  return tonapiioErrorHandler(async () => (await api.getNftItemsByOwner({
    accountId: address,
    offset: offset ?? 0,
    limit: limit ?? MAX_LIMIT,
    indirectOwnership: true,
    collection,
  })).nftItems, []);
}

export function fetchAccountEvents(network: ApiNetwork, address: string, fromSec: number, limit?: number) {
  const api = getApi(network).accountsApi;
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

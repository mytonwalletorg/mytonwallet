import { Api, HttpClient } from 'tonapi-sdk-js';

import type { ApiNetwork } from '../../../types';

import { TONAPIIO_MAINNET_URL, TONAPIIO_TESTNET_URL } from '../../../../config';
import { fetchWithRetry } from '../../../../util/fetch';
import { getEnvironment } from '../../../environment';

const MAX_LIMIT = 500;
const EVENTS_LIMIT = 100;

let apiByNetwork: Record<ApiNetwork, Api<unknown>> | undefined;

function getApi(network: ApiNetwork) {
  if (!apiByNetwork) {
    const headers = {
      ...getEnvironment().apiHeaders,
      'Content-Type': 'application/json',
    };

    apiByNetwork = {
      mainnet: new Api(new HttpClient({
        baseUrl: TONAPIIO_MAINNET_URL,
        baseApiParams: { headers },
        customFetch: fetchWithRetry as typeof fetch,
      })),
      testnet: new Api(new HttpClient({
        baseUrl: TONAPIIO_TESTNET_URL,
        baseApiParams: { headers },
        customFetch: fetchWithRetry as typeof fetch,
      })),
    };
  }

  return apiByNetwork[network];
}

export async function fetchJettonBalances(network: ApiNetwork, account: string) {
  return (await getApi(network).accounts.getAccountJettonsBalances(account, {
    supported_extensions: ['custom_payload'],
  })).balances;
}

export async function fetchNftItems(network: ApiNetwork, addresses: string[]) {
  return (await getApi(network).nft.getNftItemsByAddresses({
    account_ids: addresses,
  })).nft_items;
}

export async function fetchAccountNfts(network: ApiNetwork, address: string, options?: {
  collection?: string;
  offset?: number;
  limit?: number;
}) {
  const { collection, offset, limit } = options ?? {};

  return (await getApi(network).accounts.getAccountNftItems(
    address,
    {
      offset: offset ?? 0,
      limit: limit ?? MAX_LIMIT,
      indirect_ownership: true,
      collection,
    },
  )).nft_items;
}

export function fetchNftByAddress(network: ApiNetwork, nftAddress: string) {
  return getApi(network).nft.getNftItemByAddress(nftAddress);
}

export async function fetchAccountEvents(network: ApiNetwork, address: string, fromSec: number, limit?: number) {
  return (await getApi(network).accounts.getAccountEvents(address, {
    limit: limit ?? EVENTS_LIMIT,
    start_date: fromSec,
  })).events;
}

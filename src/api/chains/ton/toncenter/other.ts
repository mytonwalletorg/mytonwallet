import type { ApiNetwork, ApiWalletInfo } from '../../../types';
import type { ApiTonWalletVersion } from '../types';
import type { AccountState, AddressBook, MetadataMap, WalletState, WalletVersion } from './types';

import { TONCENTER_MAINNET_URL, TONCENTER_TESTNET_URL } from '../../../../config';
import { buildTxId } from '../../../../util/activities';
import { fetchJson } from '../../../../util/fetch';
import { buildCollectionByKey, mapValues, split } from '../../../../util/iteratees';
import { toBase64Address, toRawAddress } from '../util/tonCore';
import { getEnvironment } from '../../../environment';

const ADDRESS_BOOK_CHUNK_SIZE = 128;
const VERSION_MAP: Record<WalletVersion, ApiTonWalletVersion> = {
  'wallet v1 r1': 'simpleR1',
  'wallet v1 r2': 'simpleR2',
  'wallet v1 r3': 'simpleR3',
  'wallet v2 r1': 'v2R1',
  'wallet v2 r2': 'v2R2',
  'wallet v3 r1': 'v3R1',
  'wallet v3 r2': 'v3R2',
  // 'wallet v4 r1': '', // Not used in production, wrapper is missing
  'wallet v4 r2': 'v4R2',
  // 'wallet v5 beta': '', // Not used in production, wrapper is missing
  'wallet v5 r1': 'W5',
};

export async function fetchAddressBook(network: ApiNetwork, addresses: string[]): Promise<AddressBook> {
  const chunks = split(addresses, ADDRESS_BOOK_CHUNK_SIZE);

  const results = await Promise.all(chunks.map((chunk) => {
    return callToncenterV3(network, '/addressBook', {
      address: chunk,
    });
  }));

  return results.reduce((acc, value) => {
    return Object.assign(acc, value);
  }, {} as AddressBook);
}

export async function fixAddressFormat(network: ApiNetwork, address: string): Promise<string> {
  const result: { address_book: Record<string, string> } = await callToncenterV3(network, '/addressBook', { address });
  return result.address_book[address];
}

export async function getWalletStates(network: ApiNetwork, addresses: string[]) {
  const { wallets: states } = await callToncenterV3<{
    addressBook: AddressBook;
    wallets: WalletState[];
  }>(network, '/walletStates', { address: addresses.join(',') });

  const addressByRaw = Object.fromEntries(addresses.map((address) => [toRawAddress(address).toUpperCase(), address]));
  for (const state of states) {
    state.address = addressByRaw[state.address];
  }
  return buildCollectionByKey(states, 'address');
}

export async function getWalletInfos(network: ApiNetwork, addresses: string[]): Promise<Record<string, ApiWalletInfo>> {
  const states = await getWalletStates(network, addresses);
  return mapValues(states, (state) => {
    return {
      address: toBase64Address(state.address, false),
      version: state.status === 'active' && state.is_wallet ? VERSION_MAP[state.wallet_type] : undefined,
      balance: BigInt(state.balance),
      isInitialized: state.status === 'active',
      lastTxId: state.last_transaction_hash ? buildTxId(state.last_transaction_hash) : undefined,
    };
  });
}

export async function getAccountStates(network: ApiNetwork, addresses: string[]) {
  const { accounts: states } = await callToncenterV3<{
    addressBook: AddressBook;
    accounts: AccountState[];
  }>(network, '/accountStates', { address: addresses.join(',') });

  const addressByRaw = Object.fromEntries(addresses.map((address) => [toRawAddress(address), address]));
  for (const state of states) {
    state.address = addressByRaw[state.address.toLowerCase()];
  }
  return buildCollectionByKey(states, 'address');
}

export function fetchMetadata(network: ApiNetwork, addresses: string[]): Promise<MetadataMap> {
  return callToncenterV3<MetadataMap>(network, '/metadata', { address: addresses.join(',') });
}

export function callToncenterV3<T = any>(network: ApiNetwork, path: string, data?: AnyLiteral) {
  const { apiHeaders, toncenterMainnetKey, toncenterTestnetKey } = getEnvironment();
  const baseUrl = network === 'testnet' ? TONCENTER_TESTNET_URL : TONCENTER_MAINNET_URL;
  const url = `${baseUrl}/api/v3${path}`;
  const apiKey = network === 'testnet' ? toncenterTestnetKey : toncenterMainnetKey;

  return fetchJson(url, data, {
    headers: {
      ...(apiKey && { 'X-Api-Key': apiKey }),
      ...apiHeaders,
    },
  }) as Promise<T>;
}

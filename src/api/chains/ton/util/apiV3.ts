import type { ApiNetwork, ApiWalletInfo } from '../../../types';
import type { ApiTransactionExtra } from '../types';

import {
  TONCOIN,
  TONHTTPAPI_V3_MAINNET_API_URL,
  TONHTTPAPI_V3_TESTNET_API_URL,
} from '../../../../config';
import { fetchJson } from '../../../../util/fetch';
import {
  buildCollectionByKey, mapValues, omitUndefined, split,
} from '../../../../util/iteratees';
import { getEnvironment } from '../../../environment';
import { stringifyTxId } from './index';
import { toBase64Address, toRawAddress } from './tonCore';

type AddressBook = Record<string, { user_friendly: string }>;

type AccountState = {
  account_state_hash: string;
  address: string;
  balance: string;
  code_boc: string;
  code_hash: string;
  data_boc: string;
  data_hash: string;
  frozen_hash: string;
  last_transaction_hash: string;
  last_transaction_lt: number;
  status: string;
};

type WalletVersion = keyof typeof VERSION_MAP;

type WalletState = {
  address: string;
  balance: string;
  code_hash: string;
  is_signature_allowed: boolean;
  is_wallet: boolean;
  last_transaction_hash: string;
  last_transaction_lt: number;
  seqno: number;
  status: string;
  wallet_id: number;
  wallet_type: WalletVersion;
};

const ADDRESS_BOOK_CHUNK_SIZE = 128;
const VERSION_MAP = {
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
} as const;

export async function fetchTransactions(options: {
  network: ApiNetwork;
  address: string | string[];
  limit: number;
  fromTimestamp?: number;
  toTimestamp?: number;
  shouldIncludeFrom?: boolean;
  shouldIncludeTo?: boolean;
}): Promise<ApiTransactionExtra[]> {
  const {
    network, address, limit, toTimestamp, fromTimestamp,
    shouldIncludeFrom, shouldIncludeTo,
  } = options;

  const data: {
    transactions: any[];
    address_book: AddressBook;
  } = await callApiV3(network, '/transactions', {
    account: address,
    limit,
    start_utime: fromTimestamp && msToSec(fromTimestamp) + (!shouldIncludeFrom ? 1 : 0),
    end_utime: toTimestamp && msToSec(toTimestamp) - (!shouldIncludeTo ? 1 : 0),
    sort: 'desc',
  });

  const { transactions: rawTransactions, address_book: addressBook } = data;

  if (!rawTransactions.length) {
    return [];
  }

  return rawTransactions
    .map((rawTx) => parseRawTransaction(network, rawTx, addressBook))
    .flat();
}

function parseRawTransaction(network: ApiNetwork, rawTx: any, addressBook: AddressBook): ApiTransactionExtra[] {
  const {
    now,
    lt,
    hash,
    total_fees: fee,
    description: {
      compute_ph: {
        exit_code: exitCode,
      },
    },
  } = rawTx;

  const txId = stringifyTxId({ lt, hash });
  const timestamp = now as number * 1000;
  const isIncoming = !!rawTx.in_msg.source;
  const inMsgHash = rawTx.in_msg.hash;
  const msgs: any[] = isIncoming ? [rawTx.in_msg] : rawTx.out_msgs;

  if (!msgs.length) return [];

  return msgs.map((msg, i) => {
    const { source, destination, value } = msg;
    const fromAddress = addressBook[source].user_friendly;
    const toAddress = addressBook[destination].user_friendly;
    const normalizedAddress = toBase64Address(isIncoming ? source : destination, true, network);

    return omitUndefined({
      txId: msgs.length > 1 ? `${txId}:${i + 1}` : txId,
      timestamp,
      isIncoming,
      fromAddress,
      toAddress,
      amount: isIncoming ? BigInt(value) : -BigInt(value),
      slug: TONCOIN.slug,
      fee: BigInt(fee),
      inMsgHash,
      normalizedAddress,
      shouldHide: exitCode ? true : undefined,
      extraData: {
        body: getRawBody(msg),
      },
    });
  });
}

export async function fetchLatestTxId(network: ApiNetwork, address: string): Promise<string | undefined> {
  const { transactions }: { transactions: any[] } = await callApiV3(network, '/transactions', {
    account: address,
    limit: 1,
    sort: 'desc',
  });

  if (!transactions.length) {
    return undefined;
  }

  const { lt, hash } = transactions[0];

  return stringifyTxId({ lt, hash });
}

function getRawBody(msg: any) {
  if (!msg.message_content) return undefined;
  return msg.message_content.body;
}

export async function fetchAddressBook(network: ApiNetwork, addresses: string[]): Promise<AddressBook> {
  const chunks = split(addresses, ADDRESS_BOOK_CHUNK_SIZE);

  const results = await Promise.all(chunks.map((chunk) => {
    return callApiV3(network, '/addressBook', {
      address: chunk,
    });
  }));

  return results.reduce((acc, value) => {
    return Object.assign(acc, value);
  }, {} as AddressBook);
}

export async function fixAddressFormat(network: ApiNetwork, address: string): Promise<string> {
  const result: { address_book: Record<string, string> } = await callApiV3(network, '/addressBook', { address });
  return result.address_book[address];
}

export async function getWalletStates(network: ApiNetwork, addresses: string[]) {
  const { wallets: states } = await callApiV3<{
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
      version: VERSION_MAP[state.wallet_type],
      balance: BigInt(state.balance),
      isInitialized: state.status === 'active',
      lastTxId: state.last_transaction_lt && state.last_transaction_hash
        ? stringifyTxId({ lt: state.last_transaction_lt, hash: state.last_transaction_hash })
        : undefined,
    };
  });
}

export async function getAccountStates(network: ApiNetwork, addresses: string[]) {
  const { accounts: states } = await callApiV3<{
    addressBook: AddressBook;
    accounts: AccountState[];
  }>(network, '/accountStates', { address: addresses.join(',') });

  const addressByRaw = Object.fromEntries(addresses.map((address) => [toRawAddress(address), address]));
  for (const state of states) {
    state.address = addressByRaw[state.address.toLowerCase()];
  }
  return buildCollectionByKey(states, 'address');
}

function callApiV3<T = any>(network: ApiNetwork, path: string, data?: AnyLiteral) {
  const { apiHeaders, tonhttpapiMainnetKey, tonhttpapiTestnetKey } = getEnvironment();
  const baseUrl = network === 'testnet' ? TONHTTPAPI_V3_TESTNET_API_URL : TONHTTPAPI_V3_MAINNET_API_URL;
  const apiKey = network === 'testnet' ? tonhttpapiTestnetKey : tonhttpapiMainnetKey;

  return fetchJson(`${baseUrl}${path}`, data, {
    headers: {
      ...(apiKey && { 'X-Api-Key': apiKey }),
      ...apiHeaders,
    },
  }) as Promise<T>;
}

function msToSec(ms: number) {
  return Math.floor(ms / 1000);
}

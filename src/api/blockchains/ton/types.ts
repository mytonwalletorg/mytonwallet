// eslint-disable-next-line max-classes-per-file
import TonWeb from 'tonweb';
import type { Cell } from 'tonweb/dist/types/boc/cell';
import type { HttpProvider } from 'tonweb/dist/types/providers/http-provider';
import type { Address as AddressType } from 'tonweb/dist/types/utils/address';

import type { ApiParsedPayload, ApiTransaction, ApiWalletVersion } from '../../types';
import type { ContractType } from './constants';

declare class Dns {
  readonly provider: HttpProvider;

  constructor(provider: HttpProvider);
  getWalletAddress(domain: string): Promise<AddressType | null>;
}

export declare class MyTonWeb extends TonWeb {
  dns: Dns;
}

export type AnyPayload = string | Uint8Array | Cell;

export interface ApiTransactionExtra extends ApiTransaction {
  extraData: {
    normalizedAddress: string;
    body?: string;
    parsedPayload?: ApiParsedPayload;
  };
}

export interface TokenTransferBodyParams {
  queryId?: number;
  tokenAmount: bigint;
  toAddress: string;
  responseAddress: string;
  forwardAmount: bigint;
  forwardPayload?: AnyPayload;
}

export interface TonTransferParams {
  toAddress: string;
  amount: bigint;
  payload?: AnyPayload;
  stateInit?: Cell;
  isBase64Payload?: boolean;
}

export interface JettonMetadata {
  name: string;
  symbol: string;
  description?: string;
  decimals?: number | string;
  image?: string;
  image_data?: string;
  uri?: string;
}

export type ContractName = ApiWalletVersion | 'highloadV2' | 'nominatorPool';

export type ContractInfo = {
  name: ContractName;
  type: ContractType;
  hash: string;
};

export type GetAddressInfoResponse = {
  '@type': 'raw.fullAccountState';
  balance: string | 0;
  code: string;
  data: string;
  last_transaction_id: {
    '@type': 'internal.transactionId';
    lt: string;
    hash: string;
  };
  block_id: {
    '@type': 'ton.blockIdExt';
    workchain: number;
    shard: string;
    seqno: number;
    root_hash: string;
    file_hash: string;
  };
  frozen_hash: string;
  sync_utime: number;
  '@extra': string;
  state: 'uninitialized' | 'active';
};

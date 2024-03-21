import type { Cell } from '@ton/core';

import type {
  ApiParsedPayload, ApiTransaction, ApiWalletInfo, ApiWalletVersion,
} from '../../types';
import type { ContractType } from './constants';
import type { TonWallet } from './util/tonCore';

export type AnyPayload = string | Cell | Uint8Array;

export interface ApiTransactionExtra extends ApiTransaction {
  extraData: {
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

export interface InitData {
  code?: Cell;
  data?: Cell;
}

export type ContractName = ApiWalletVersion | 'v4R1' | 'highloadV2' | 'multisig' | 'multisigV2'
| 'nominatorPool' | 'vesting' | 'dedustPool' | 'dedustVaultNative' | 'dedustVaultJetton' | 'dedustVaultNative2'
| 'stonPtonWallet' | 'stonRouter' | 'megatonWtonMaster' | 'megatonRouter';

export type ContractInfo = {
  name: ContractName;
  type?: ContractType;
  hash: string;
  isLedgerAllowed?: boolean;
  isSwapAllowed?: boolean;
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

export type WalletInfo = ApiWalletInfo & {
  wallet: TonWallet;
};

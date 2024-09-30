import type { Cell } from '@ton/core';

import type { DieselStatus } from '../../../global/types';
import type {
  ApiAnyDisplayError, ApiParsedPayload, ApiTransaction,
} from '../../types';
import type { ContractType } from './constants';

export type ApiTonWalletVersion = 'simpleR1'
| 'simpleR2'
| 'simpleR3'
| 'v2R1'
| 'v2R2'
| 'v3R1'
| 'v3R2'
| 'v4R2'
| 'W5';

export type AnyPayload = string | Cell | Uint8Array;

export interface ApiTransactionExtra extends ApiTransaction {
  extraData: {
    body?: string;
    parsedPayload?: ApiParsedPayload;
  };
}

export interface TokenTransferBodyParams {
  queryId?: bigint;
  tokenAmount: bigint;
  toAddress: string;
  responseAddress: string;
  forwardAmount: bigint;
  forwardPayload?: AnyPayload;
  customPayload?: Cell;
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
  custom_payload_api_uri?: string;
}

export interface InitData {
  code?: Cell;
  data?: Cell;
}

export type ContractName = ApiTonWalletVersion | 'v4R1' | 'highloadV2' | 'multisig' | 'multisigV2' | 'multisigNew'
| 'nominatorPool' | 'vesting' | 'dedustPool' | 'dedustVaultNative' | 'dedustVaultJetton'
| 'stonPtonWallet' | 'stonRouter' | 'megatonWtonMaster' | 'megatonRouter';

export type ContractInfo = {
  name: ContractName;
  type?: ContractType;
  hash: string;
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

export type ApiSubmitTransferTonResult = {
  toAddress: string;
  amount: bigint;
  seqno: number;
  msgHash: string;
  encryptedComment?: string;
} | {
  error: string;
};

export type ApiSubmitMultiTransferResult = {
  messages: TonTransferParams[];
  amount: string;
  seqno: number;
  boc: string;
  msgHash: string;
  paymentLink?: string;
} | {
  error: string;
};

export type ApiCheckTransactionDraftResult = {
  fee?: bigint;
  addressName?: string;
  isScam?: boolean;
  resolvedAddress?: string;
  isToAddressNew?: boolean;
  isBounceable?: boolean;
  isMemoRequired?: boolean;
  error?: ApiAnyDisplayError;
  dieselStatus?: DieselStatus;
  dieselAmount?: bigint;
};

export type ApiSubmitTransferWithDieselResult = ApiSubmitMultiTransferResult & {
  encryptedComment?: string;
};

export type ApiSubmitTransferOptions = {
  accountId: string;
  password: string;
  toAddress: string;
  amount: bigint;
  data?: AnyPayload;
  tokenAddress?: string;
  stateInit?: Cell;
  shouldEncrypt?: boolean;
  isBase64Data?: boolean;
};

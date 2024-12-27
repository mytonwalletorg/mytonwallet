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

export type ContractName = ApiTonWalletVersion
| 'v4R1' | 'highloadV2' | 'multisig' | 'multisigV2' | 'multisigNew'
| 'nominatorPool' | 'vesting'
| 'dedustPool' | 'dedustVaultNative' | 'dedustVaultJetton'
| 'stonPtonWallet' | 'stonRouter' | 'stonRouterV2_1' | 'stonPoolV2_1'
| 'stonRouterV2_2' | 'stonPoolV2_2' | 'stonPtonWalletV2'
| 'megatonWtonMaster' | 'megatonRouter';

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

export type ApiFetchEstimateDieselResult = {
  status: DieselStatus;
  /**
   * The amount of diesel that will be sent together with the actual transfer. None of this will return back as the
   * excess. Charged on top of the transferred amount. If the value is undefined, the diesel transfer is impossible
   * (the reason is defined by the status). When defined, guaranteed to be > 0.
   *
   * Measured in the transferred token, but if `status` is "stars-fee", measured in stars (the stars' BigInt assumes
   * the same number of decimal places as the transferred token).
   */
  tokenAmount?: bigint;
  /**
   * The native token amount covered by the diesel. Guaranteed to be > 0.
   */
  nativeAmount: bigint;
  /**
   * The remaining part of the fee (the first part is `nativeAmount`) that will be taken from the existing wallet
   * balance. Guaranteed that this amount is available in the wallet. Measured in the native token.
   */
  remainingFee: bigint;
  /**
   * An approximate fee that will be actually spent. The difference between `nativeAmount+nativeRemainder` and this
   * number is called "excess" and will be returned back to the wallet. Measured in the native token.
   */
  realFee: bigint;
  /**
   * Whether the diesel should be used even when it's not necessary.
   */
  shouldPrefer: boolean;
};

export type ApiCheckTransactionDraftResult = {
  /**
   * The full fee that will be appended to the transaction. Measured in the native token. It's charged on top of the
   * transferred amount, unless it's a full-TON transfer.
   */
  fee?: bigint;
  /**
   * An approximate fee that will be actually spent. The difference between `fee` and this number is called "excess" and
   * will be returned back to the wallet. Measured in the native token. Undefined means that it can't be estimated.
   * If the value is equal to `fee`, then it's known that there will be no excess.
   */
  realFee?: bigint;
  addressName?: string;
  isScam?: boolean;
  resolvedAddress?: string;
  isToAddressNew?: boolean;
  isBounceable?: boolean;
  isMemoRequired?: boolean;
  error?: ApiAnyDisplayError;
  /**
   * Describes a possibility to use diesel for this transfer. The UI should prefer diesel when this field is defined,
   * and the diesel status is not "not-available". When the diesel is available, and the UI decides to use it, the `fee`
   * and `realFee` fields should be ignored, because they don't consider an extra transfer of the diesel to the
   * MTW wallet.
   */
  diesel?: ApiFetchEstimateDieselResult;
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
  forwardAmount?: bigint;
};

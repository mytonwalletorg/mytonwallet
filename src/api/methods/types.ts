import type { Cell } from '@ton/core';

import type { ApiSubmitTransferTonResult } from '../chains/ton/types';
import type { ApiSubmitTransferTronResult } from '../chains/tron/types';
import type * as methods from './index';

export type Methods = typeof methods;
export type MethodArgs<N extends keyof Methods> = Parameters<Methods[N]>;
export type MethodResponse<N extends keyof Methods> = ReturnType<Methods[N]>;

export type CheckTransactionDraftOptions = {
  accountId: string;
  toAddress: string;
  amount: bigint;
  tokenAddress?: string;
  data?: string | Uint8Array | Cell;
  stateInit?: string;
  shouldEncrypt?: boolean;
  isBase64Data?: boolean;
  isGaslessWithStars?: boolean;
};

export interface ApiSubmitTransferOptions {
  accountId: string;
  password: string;
  toAddress: string;
  amount: bigint;
  comment?: string;
  tokenAddress?: string;
  fee?: bigint;
  shouldEncrypt?: boolean;
  isBase64Data?: boolean;
  withDiesel?: boolean;
  dieselAmount?: bigint;
  stateInit?: string | Cell;
  isGaslessWithStars?: boolean;
}

export type ApiSubmitTransferResult = ApiSubmitTransferTonResult | ApiSubmitTransferTronResult;

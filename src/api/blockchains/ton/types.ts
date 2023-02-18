// eslint-disable-next-line max-classes-per-file
import { Cell } from 'tonweb/dist/types/boc/cell';
import { HttpProvider } from 'tonweb/dist/types/providers/http-provider';
import { Address as AddressType } from 'tonweb/dist/types/utils/address';
import TonWeb from 'tonweb';

import { ApiTransaction } from '../../types';

type ApiRequiredFields = 'fromAddress' | 'toAddress' | 'comment' | 'isIncoming';

export type AnyTransaction = Omit<ApiTransaction, ApiRequiredFields> & Partial<Pick<ApiTransaction, ApiRequiredFields>>;

export interface ApiTransactionWithLt extends ApiTransaction {
  lt: number;
}

export interface AnyTransactionWithLt extends AnyTransaction {
  lt: number;
}

declare class Dns {
  readonly provider: HttpProvider;

  constructor(provider: HttpProvider);
  getWalletAddress(domain: string): Promise<AddressType | null>;
}

export declare class MyTonWeb extends TonWeb {
  dns: Dns;
}

export interface TokenTransferBodyParams {
  queryId?: number;
  tokenAmount: string;
  toAddress: string;
  responseAddress: string;
  forwardAmount: string;
  forwardPayload: Cell;
}

export interface TonTransferParams {
  toAddress: string;
  amount: string;
  payload?: string | Uint8Array | Cell;
  stateInit?: Cell;
}

// eslint-disable-next-line max-classes-per-file
import TonWeb from 'tonweb';
import type { Cell } from 'tonweb/dist/types/boc/cell';
import type { HttpProvider } from 'tonweb/dist/types/providers/http-provider';
import type { Address as AddressType } from 'tonweb/dist/types/utils/address';

import type { ApiTransaction } from '../../types';

declare class Dns {
  readonly provider: HttpProvider;

  constructor(provider: HttpProvider);
  getWalletAddress(domain: string): Promise<AddressType | null>;
}

export declare class MyTonWeb extends TonWeb {
  dns: Dns;
}

export interface ApiTransactionExtra extends ApiTransaction {
  extraData?: { body?: any };
}

export interface TokenTransferBodyParams {
  queryId?: number;
  tokenAmount: string;
  toAddress: string;
  responseAddress: string;
  forwardAmount: string;
  forwardPayload?: Cell | string;
}

export interface TonTransferParams {
  toAddress: string;
  amount: string;
  payload?: string | Uint8Array | Cell;
  stateInit?: Cell;
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

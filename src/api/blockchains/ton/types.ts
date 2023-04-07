// eslint-disable-next-line max-classes-per-file
import { Cell } from 'tonweb/dist/types/boc/cell';
import { HttpProvider } from 'tonweb/dist/types/providers/http-provider';
import { Address as AddressType } from 'tonweb/dist/types/utils/address';
import TonWeb from 'tonweb';
import { ApiTransaction } from '../../types';

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
  forwardPayload: Cell;
}

export interface TonTransferParams {
  toAddress: string;
  amount: string;
  payload?: string | Uint8Array | Cell;
  stateInit?: Cell;
}

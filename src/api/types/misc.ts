import type TonWeb from 'tonweb';

import type { ApiParsedPayload } from './payload';
import type { ApiSseOptions } from './storage';

export type ApiWalletVersion = keyof typeof TonWeb.Wallets['all'];

export type ApiBlockchainKey = 'ton';
export type ApiNetwork = 'mainnet' | 'testnet';
export type ApiLedgerDriver = 'HID' | 'USB';

export interface AccountIdParsed {
  id: number;
  blockchain: ApiBlockchainKey;
  network: ApiNetwork;
}

export interface ApiInitArgs {
  origin: string;
  newestTxId?: string;
}

export interface ApiBaseToken {
  name: string;
  symbol: string;
  slug: string;
  decimals: number;
  minterAddress?: string;
  image?: string;
  isPopular?: boolean;
  keywords?: string[];
}

export interface ApiToken extends ApiBaseToken {
  quote: ApiTokenPrice;
}

export interface ApiTokenPrice {
  price: number;
  percentChange1h: number;
  percentChange24h: number;
  percentChange7d: number;
  percentChange30d: number;
  history24h?: ApiHistoryList;
  history7d?: ApiHistoryList;
  history30d?: ApiHistoryList;
}

export type ApiKnownAddresses = Record<string, ApiAddressInfo>;

export interface ApiAddressInfo {
  name?: string;
  isScam?: boolean;
}

export type ApiTxIdBySlug = Record<string, string | undefined>;
export type ApiTransactionType = 'stake' | 'unstake' | 'unstakeRequest' | undefined;

export interface ApiTransaction {
  txId: string;
  timestamp: number;
  amount: string;
  fromAddress: string;
  toAddress: string;
  comment?: string;
  encryptedComment?: string;
  fee: string;
  slug: string;
  isIncoming: boolean;
  type?: ApiTransactionType;
  metadata?: ApiTransactionMetadata;
}

export interface ApiTransactionMetadata extends ApiAddressInfo {
}

export interface ApiNft {
  index: number;
  name?: string;
  address: string;
  thumbnail: string;
  image: string;
  collectionName?: string;
  collectionAddress?: string;
  isOnSale: boolean;
}

export type ApiHistoryList = Array<[number, number]>;
export type ApiTokenSimple = Omit<ApiToken, 'quote'>;

export interface ApiPoolState {
  startOfCycle: number;
  endOfCycle: number;
  lastApy: number;
  minStake: number;
}

export interface ApiStakingState {
  amount: number;
  pendingDepositAmount: number;
  isUnstakeRequested: boolean;
}

export interface ApiBackendStakingState {
  poolAddress: string;
  balance: number;
  totalProfit: number;
  poolState: ApiPoolState;
  profitHistory: {
    timestamp: number;
    profit: number;
  }[];
}

export interface ApiDappPermissions {
  isAddressRequired?: boolean;
  isPasswordRequired?: boolean;
}

export type ApiDappRequest = {
  origin?: string;
  accountId?: string;
  sseOptions?: ApiSseOptions;
} | {
  origin: string;
  accountId: string;
};

export interface ApiDappTransaction {
  toAddress: string;
  amount: string;
  rawPayload?: string;
  payload?: ApiParsedPayload;
  stateInit?: string;
}

export interface ApiSubmitTransferOptions {
  accountId: string;
  password: string;
  slug: string;
  toAddress: string;
  amount: string;
  comment?: string;
  fee?: string;
  shouldEncrypt?: boolean;
}

export enum Workchain {
  MasterChain = -1,
  BaseChain = 0,
}

export const WORKCHAIN = Workchain.BaseChain;
export const TRANSFER_TIMEOUT_SEC = 60; // 1 min.

export interface ApiSignedTransfer {
  base64: string;
  seqno: number;
  params: ApiLocalTransactionParams;
}

export interface ApiLocalTransactionParams {
  amount: string;
  fromAddress: string;
  toAddress: string;
  comment?: string;
  fee: string;
  slug: string;
  type?: ApiTransactionType;
  encryptedComment?: string;
}

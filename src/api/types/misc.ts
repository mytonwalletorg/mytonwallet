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
  isElectron: boolean;
  isNativeBottomSheet: boolean;
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
  cmcSlug?: string;
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
export type ApiTransactionType = 'stake' | 'unstake' | 'unstakeRequest' | 'swap' | undefined;

export interface ApiTransaction {
  txId: string;
  timestamp: number;
  amount: bigint;
  fromAddress: string;
  toAddress: string;
  comment?: string;
  encryptedComment?: string;
  fee: bigint;
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
  isHidden?: boolean;
}

export type ApiHistoryList = Array<[number, number]>;
export type ApiTokenSimple = Omit<ApiToken, 'quote'>;

export type ApiStakingType = 'nominators' | 'liquid';

export type ApiStakingState = {
  type: 'nominators';
  amount: bigint;
  pendingDepositAmount: bigint;
  isUnstakeRequested: boolean;
} | {
  type: 'liquid';
  tokenAmount: bigint;
  amount: bigint;
  unstakeRequestAmount: bigint;
  apy: number;
  instantAvailable: bigint;
};

export interface ApiNominatorsPool {
  address: string;
  apy: number;
  start: number;
  end: number;
}

export interface ApiBackendStakingState {
  balance: bigint;
  totalProfit: bigint;
  nominatorsPool: ApiNominatorsPool;
  loyaltyType?: ApiLoyaltyType;
  shouldUseNominators?: boolean;
  stakedAt?: number;
}

export type ApiStakingHistory = {
  timestamp: number;
  profit: number;
}[];

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
  amount: bigint;
  rawPayload?: string;
  payload?: ApiParsedPayload;
  stateInit?: string;
}

export interface ApiSubmitTransferOptions {
  accountId: string;
  password: string;
  slug: string;
  toAddress: string;
  amount: bigint;
  comment?: string;
  fee?: bigint;
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

export type ApiLocalTransactionParams = Omit<ApiTransaction, 'txId' | 'timestamp' | 'isIncoming'>;

export type ApiBaseCurrency = 'USD' | 'EUR' | 'RUB' | 'CNY' | 'BTC' | 'TON';

export enum ApiLiquidUnstakeMode {
  Default,
  Instant,
  BestRate,
}

export type ApiLoyaltyType = 'black' | 'platinum' | 'gold' | 'silver' | 'standard';

export type ApiBalanceBySlug = Record<string, bigint>;

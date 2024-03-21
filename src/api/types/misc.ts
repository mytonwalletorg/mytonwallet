import type { ApiParsedPayload } from './payload';
import type { ApiSseOptions } from './storage';

export type ApiWalletVersion = 'simpleR1'
| 'simpleR2'
| 'simpleR3'
| 'v2R1'
| 'v2R2'
| 'v3R1'
| 'v3R2'
| 'v4R2';

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
  isIosApp: boolean;
  isAndroidApp: boolean;
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
  color?: string;
}

export interface ApiToken extends ApiBaseToken {
  quote: ApiTokenPrice;
}

export interface ApiTokenPrice {
  slug: string;
  price: number;
  priceUsd: number;
  percentChange24h: number;
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
  normalizedAddress: string;
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
  type?: ApiStakingType;
  nominatorsPool: ApiNominatorsPool;
  loyaltyType?: ApiLoyaltyType;
  shouldUseNominators?: boolean;
  stakedAt?: number;
}

export type ApiStakingHistory = {
  timestamp: number;
  profit: string;
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

export type ApiLocalTransactionParams = Omit<ApiTransaction, 'txId' | 'timestamp' | 'isIncoming' | 'normalizedAddress'>;

export type ApiBaseCurrency = 'USD' | 'EUR' | 'RUB' | 'CNY' | 'BTC' | 'TON';

export enum ApiLiquidUnstakeMode {
  Default,
  Instant,
  BestRate,
}

export type ApiLoyaltyType = 'black' | 'platinum' | 'gold' | 'silver' | 'standard';

export type ApiBalanceBySlug = Record<string, bigint>;

export type ApiWalletInfo = {
  address: string;
  version: ApiWalletVersion;
  balance: bigint;
  isInitialized: boolean;
  lastTxId?: string;
};

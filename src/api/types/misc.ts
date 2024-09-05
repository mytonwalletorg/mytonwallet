import type { Cell } from '@ton/core';

import type { DNS_ZONES_MAP } from '../blockchains/ton/constants';
import type { ApiParsedPayload } from './payload';
import type { ApiSseOptions } from './storage';

export type ApiWalletVersion = 'simpleR1'
| 'simpleR2'
| 'simpleR3'
| 'v2R1'
| 'v2R2'
| 'v3R1'
| 'v3R2'
| 'v4R2'
| 'W5';

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
  isMemoRequired?: boolean;
}

export type ApiTxIdBySlug = Record<string, string | undefined>;
export type ApiTransactionType = 'stake' | 'unstake' | 'unstakeRequest' | 'swap'
| 'nftTransferred' | 'nftReceived' | undefined;

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
  inMsgHash: string;
  shouldHide?: boolean;
  type?: ApiTransactionType;
  metadata?: ApiTransactionMetadata;
  nft?: ApiNft;
}

export interface ApiTransactionMetadata extends ApiAddressInfo {
}

export interface ApiNft {
  index: number;
  name?: string;
  address: string;
  thumbnail: string;
  image: string;
  description?: string;
  collectionName?: string;
  collectionAddress?: string;
  isOnSale: boolean;
  isHidden?: boolean;
  isOnFragment?: boolean;
  isScam?: boolean;
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

export interface ApiDappTransfer {
  toAddress: string;
  amount: bigint;
  rawPayload?: string;
  payload?: ApiParsedPayload;
  stateInit?: string;
  isScam?: boolean;
}

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
}

export enum Workchain {
  MasterChain = -1,
  BaseChain = 0,
}

export interface ApiSignedTransfer {
  base64: string;
  seqno: number;
  params: Omit<ApiLocalTransactionParams, 'inMsgHash'>;
}

export type ApiLocalTransactionParams = Omit<
ApiTransaction, 'txId' | 'timestamp' | 'isIncoming' | 'normalizedAddress'
> & {
  normalizedAddress?: string;
};

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

export type ApiDnsZone = keyof typeof DNS_ZONES_MAP;

// Country codes from ISO-3166-1 spec
export type ApiCountryCode = 'AF' | 'AX' | 'AL' | 'DZ' | 'AS' | 'AD' | 'AO' | 'AI' | 'AQ' | 'AG' | 'AR'
| 'AM' | 'AW' | 'AU' | 'AT' | 'AZ' | 'BS' | 'BH' | 'BD' | 'BB' | 'BY' | 'BE' | 'BZ' | 'BJ' | 'BM'
| 'BT' | 'BO' | 'BQ' | 'BA' | 'BW' | 'BV' | 'BR' | 'IO' | 'BN' | 'BG' | 'BF' | 'BI' | 'CV' | 'KH'
| 'CM' | 'CA' | 'KY' | 'CF' | 'TD' | 'CL' | 'CN' | 'CX' | 'CC' | 'CO' | 'KM' | 'CG' | 'CD' | 'CK'
| 'CR' | 'CI' | 'HR' | 'CU' | 'CW' | 'CY' | 'CZ' | 'DK' | 'DJ' | 'DM' | 'DO' | 'EC' | 'EG' | 'SV'
| 'GQ' | 'ER' | 'EE' | 'SZ' | 'ET' | 'FK' | 'FO' | 'FJ' | 'FI' | 'FR' | 'GF' | 'PF' | 'TF' | 'GA'
| 'GM' | 'GE' | 'DE' | 'GH' | 'GI' | 'GR' | 'GL' | 'GD' | 'GP' | 'GU' | 'GT' | 'GG' | 'GN' | 'GW'
| 'GY' | 'HT' | 'HM' | 'VA' | 'HN' | 'HK' | 'HU' | 'IS' | 'IN' | 'ID' | 'IR' | 'IQ' | 'IE' | 'IM'
| 'IL' | 'IT' | 'JM' | 'JP' | 'JE' | 'JO' | 'KZ' | 'KE' | 'KI' | 'KP' | 'KR' | 'KW' | 'KG' | 'LA'
| 'LV' | 'LB' | 'LS' | 'LR' | 'LY' | 'LI' | 'LT' | 'LU' | 'MO' | 'MG' | 'MW' | 'MY' | 'MV' | 'ML'
| 'MT' | 'MH' | 'MQ' | 'MR' | 'MU' | 'YT' | 'MX' | 'FM' | 'MD' | 'MC' | 'MN' | 'ME' | 'MS' | 'MA'
| 'MZ' | 'MM' | 'NA' | 'NR' | 'NP' | 'NL' | 'NC' | 'NZ' | 'NI' | 'NE' | 'NG' | 'NU' | 'NF' | 'MP'
| 'NO' | 'OM' | 'PK' | 'PW' | 'PS' | 'PA' | 'PG' | 'PY' | 'PE' | 'PH' | 'PN' | 'PL' | 'PT' | 'PR'
| 'QA' | 'MK' | 'RO' | 'RU' | 'RW' | 'RE' | 'BL' | 'SH' | 'KN' | 'LC' | 'MF' | 'PM' | 'VC' | 'WS'
| 'SM' | 'ST' | 'SA' | 'SN' | 'RS' | 'SC' | 'SL' | 'SG' | 'SX' | 'SK' | 'SI' | 'SB' | 'SO' | 'ZA'
| 'GS' | 'SS' | 'ES' | 'LK' | 'SD' | 'SR' | 'SJ' | 'SE' | 'CH' | 'SY' | 'TW' | 'TJ' | 'TZ' | 'TH'
| 'TL' | 'TG' | 'TK' | 'TO' | 'TT' | 'TN' | 'TR' | 'TM' | 'TC' | 'TV' | 'UG' | 'UA' | 'AE' | 'GB'
| 'US' | 'UM' | 'UY' | 'UZ' | 'VU' | 'VE' | 'VN' | 'VG' | 'VI' | 'WF' | 'EH' | 'YE' | 'ZM' | 'ZW';

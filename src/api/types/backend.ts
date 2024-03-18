// Decentralized swap of TON and tokens
import type { ApiLoyaltyType } from './misc';

export type ApiSwapEstimateRequest = {
  from: string;
  to: string;
  slippage: number;
  fromAmount?: string;
  toAmount?: string;
  fromAddress: string;
};

export type ApiSwapEstimateResponse = ApiSwapEstimateRequest & {
  toAmount: string;
  fromAmount: string;
  toMinAmount: string;
  networkFee: number;
  realNetworkFee: number;
  swapFee: string;
  swapFeePercent: number;
  impact: number;
  dexLabel: string;
};

export type ApiSwapBuildRequest = Omit<ApiSwapEstimateResponse, 'impact' | 'swapFeePercent' | 'realNetworkFee'> & {
  fromAddress: string;
};

export type ApiSwapTransfer = {
  toAddress: string;
  amount: string;
  payload: string;
};

export type ApiSwapBuildResponse = {
  id: string;
  request: ApiSwapBuildRequest;
  transfers: ApiSwapTransfer[];
};

// Swap assets and history
export type ApiSwapAsset = {
  name: string;
  symbol: string;
  blockchain: string;
  slug: string;
  decimals: number;
  isPopular: boolean;
  price: number;
  priceUsd: number;
  image?: string;
  contract?: string;
  keywords?: string[];
  color?: string;
};

export type ApiSwapTonAsset = ApiSwapAsset & {
  blockchain: 'ton';
};

export type ApiSwapPairAsset = {
  symbol: string;
  slug: string;
  contract?: string;
  isReverseProhibited?: boolean;
};

export type ApiSwapHistoryItem = {
  id: string;
  timestamp: number;
  lt?: number;
  from: string;
  fromAmount: string;
  to: string;
  toAmount: string;
  networkFee: number;
  swapFee: string;
  status: 'pending' | 'completed' | 'failed' | 'expired';
  txIds: string[];
  cex?: {
    payinAddress: string;
    payinExtraId?: string;
    status: ApiSwapCexTransactionStatus;
    transactionId: string;
  };
};

// Cross-chain centralized swap
type ApiSwapCexTransactionStatus = 'new' | 'waiting' | 'confirming' | 'exchanging' | 'sending' | 'finished'
| 'failed' | 'refunded' | 'hold' | 'overdue' | 'expired';

export type ApiSwapCexEstimateRequest = {
  from: string;
  fromAmount: string;
  to: string;
};

export type ApiSwapCexEstimateResponse = {
  from: string;
  fromAmount: string;
  to: string;
  toAmount: string;
  swapFee: string;
  // additional
  fromMin: string;
  fromMax: string;
};

export type ApiSwapCexCreateTransactionRequest = {
  from: string;
  fromAmount: string;
  fromAddress: string; // Always TON address
  to: string;
  toAddress: string; // TON or other crypto address
  payoutExtraId?: string;
  swapFee: string; // from estimate request
  networkFee?: number; // only for sent TON
};

export type ApiSwapCexCreateTransactionResponse = {
  request: ApiSwapCexCreateTransactionRequest;
  swap: ApiSwapHistoryItem;
};

// Staking
export type ApiStakingCommonData = {
  liquid: {
    currentRate: number;
    nextRoundRate: number;
    collection?: string;
    apy: number;
    available: bigint;
    loyaltyApy: {
      [key in ApiLoyaltyType]: number;
    };
  };
  round: {
    start: number;
    end: number;
    unlock: number;
  };
  prevRound: {
    start: number;
    end: number;
    unlock: number;
  };
  bigInt: bigint;
};

export type ApiBackendDapp = {
  url: string;
  name: string;
  icon: string;
  manifestUrl: string;
  description: string;
  canBeRestricted: boolean;
  isExternal: boolean;
};

// Prices
export type ApiPriceHistoryPeriod = '1D' | '7D' | '1M' | '3M' | '1Y' | 'ALL';

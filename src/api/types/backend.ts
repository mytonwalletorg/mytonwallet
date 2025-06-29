import type { DieselStatus } from '../../global/types';
import type { StakingPoolConfig } from '../chains/ton/contracts/JettonStaking/StakingPool';
import type { ApiTonWalletVersion } from '../chains/ton/types';
import type { ApiCountryCode, ApiLoyaltyType, ApiMtwCardType, ApiTokenWithPrice } from './misc';

export type ApiTokenDetails = Pick<ApiTokenWithPrice, 'slug' | 'type' | 'price' | 'priceUsd' | 'percentChange24h'>;

export type ApiSwapDexLabel = 'dedust' | 'ston';

export type ApiSwapEstimateRequest = {
  from: string;
  to: string;
  slippage: number;
  fromAmount?: string;
  toAmount?: string;
  fromAddress: string;
  shouldTryDiesel?: boolean;
  swapVersion?: 1 | 2;
  toncoinBalance?: string;
  walletVersion?: ApiTonWalletVersion;
  isFromAmountMax?: boolean;
};

export type ApiSwapEstimateVariant = {
  fromAmount: string;
  toAmount: string;
  toMinAmount: string;
  impact: number;
  dexLabel: ApiSwapDexLabel;
  // Fees
  networkFee: string;
  realNetworkFee: string;
  swapFee: string;
  swapFeePercent: number;
  ourFee: string;
  dieselFee?: string;
};

export type ApiSwapEstimateResponse = ApiSwapEstimateRequest & {
  toAmount: string;
  fromAmount: string;
  toMinAmount: string;
  impact: number;
  dexLabel: ApiSwapDexLabel;
  dieselStatus: DieselStatus;
  other?: ApiSwapEstimateVariant[];
  // Fees
  networkFee: string;
  realNetworkFee: string;
  swapFee: string;
  swapFeePercent: number;
  ourFee: string;
  ourFeePercent: number;
  dieselFee?: string;
};

export type ApiSwapBuildRequest = Pick<ApiSwapEstimateResponse,
  'from'
  | 'to'
  | 'fromAddress'
  | 'dexLabel'
  | 'fromAmount'
  | 'toAmount'
  | 'toMinAmount'
  | 'slippage'
  | 'shouldTryDiesel'
  | 'swapVersion'
  | 'networkFee'
  | 'swapFee'
  | 'ourFee'
  | 'dieselFee'
> & {
  walletVersion?: ApiTonWalletVersion;
};

export type ApiSwapTransfer = {
  toAddress: string;
  amount: string;
  payload: string;
};

export type ApiSwapBuildResponse = {
  id: string;
  transfers: ApiSwapTransfer[];
};

// Swap assets and history
export type ApiSwapAsset = {
  name: string;
  symbol: string;
  chain: string;
  slug: string;
  decimals: number;
  isPopular: boolean;
  price: number;
  priceUsd: number;
  image?: string;
  tokenAddress?: string;
  keywords?: string[];
  color?: string;
};

export type ApiSwapTonAsset = ApiSwapAsset & {
  chain: 'ton';
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
  /** The real fee in the chain's native token */
  networkFee: string;
  swapFee: string;
  ourFee?: string;
  status: 'pending' | 'completed' | 'failed' | 'expired';
  hashes: string[];
  isCanceled?: boolean;
  cex?: {
    payinAddress: string;
    payoutAddress: string;
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
  networkFee?: string; // only for sent TON
};

export type ApiSwapCexCreateTransactionResponse = {
  request: ApiSwapCexCreateTransactionRequest;
  swap: ApiSwapHistoryItem;
};

// Staking
export type ApiStakingJettonPool = {
  pool: string;
  poolConfig: StakingPoolConfig;
  token: string;
  periods: {
    period: number;
    unstakeCommission: number;
    token: string;
  }[];
};

/** Note: all the timestamps are in Unix seconds */
export type ApiStakingCommonResponse = {
  liquid: {
    currentRate: number;
    nextRoundRate: number;
    collection?: string;
    apy: number;
    /** The string is a floating point number */
    available: string;
    loyaltyApy: Record<ApiLoyaltyType, number>;
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
  jettonPools: Omit<ApiStakingJettonPool, 'poolConfig'>[];
  ethena: {
    apy: number;
    apyVerified: number;
    rate: number;
    isDisabled?: boolean;
  };
};

/** Note: all timestamps are in Unix milliseconds */
export type ApiStakingCommonData = Override<ApiStakingCommonResponse, {
  liquid: Override<ApiStakingCommonResponse['liquid'], {
    available: bigint;
  }>;
  jettonPools: ApiStakingJettonPool[];
}>;

export type ApiSite = {
  url: string;
  name: string;
  icon: string;
  manifestUrl: string;
  description: string;
  canBeRestricted: boolean;
  isExternal: boolean;
  isFeatured?: boolean;
  categoryId?: number;

  extendedIcon?: string;
  badgeText?: string;
  withBorder?: boolean;
};

export type ApiSiteCategory = {
  id: number;
  name: string;
};

// Prices
export type ApiPriceHistoryPeriod = '1D' | '7D' | '1M' | '3M' | '1Y' | 'ALL';

// Vesting
export type ApiVestingPartStatus = 'frozen' | 'ready' | 'unfrozen' | 'missed';

export type ApiVestingInfo = {
  id: number;
  title: string;
  startsAt: Date;
  initialAmount: number;
  parts: {
    id: number;
    time: string;
    timeEnd: string;
    amount: number;
    status: ApiVestingPartStatus;
  }[];
};

export type ApiCardInfo = {
  all: number;
  notMinted: number;
  price: number;
};

export type ApiCardsInfo = Record<ApiMtwCardType, ApiCardInfo>;

export type ApiAccountConfig = {
  cardsInfo?: ApiCardsInfo;
};

export type ApiBackendConfig = {
  isLimited: boolean;
  isCopyStorageEnabled?: boolean;
  supportAccountsCount?: number;
  now: number;
  country: ApiCountryCode;
  isUpdateRequired: boolean;
  isVestingEnabled?: boolean;
  isWebSocketEnabled?: boolean;
};

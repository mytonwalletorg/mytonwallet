import type { StakingPoolConfig } from '../chains/ton/contracts/JettonStaking/StakingPool';

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
    /** The string is a floating point number */
    tvl: string;
    totalStakers: number;
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
};

/** Note: all timestamps are in Unix milliseconds */
export type ApiStakingCommonData = Override<ApiStakingCommonResponse, {
  liquid: Override<ApiStakingCommonResponse['liquid'], {
    available: bigint;
    tvl: bigint;
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
  isVerified?: boolean;
  categoryId?: number;

  extendedIcon?: string;
  badgeText?: string;
  withBorder?: boolean;
  borderColor?: [string, string?];
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

export type ApiBackendConfig = {
  isLimited: boolean;
  isCopyStorageEnabled?: boolean;
  now: number;
  isUpdateRequired: boolean;
};

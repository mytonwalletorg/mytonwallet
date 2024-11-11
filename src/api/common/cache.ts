import type { ApiBaseCurrency, ApiStakingCommonData, ApiTokenPrice } from '../types';

import { DEFAULT_PRICE_CURRENCY } from '../../config';

export type AccountCache = { stakedAt?: number };

let stakingCommonCache: ApiStakingCommonData;
const accountCache: Record<string, AccountCache> = {};
const pricesCache: {
  baseCurrency: ApiBaseCurrency;
  bySlug: Record<string, ApiTokenPrice>;
} = {
  baseCurrency: DEFAULT_PRICE_CURRENCY,
  bySlug: {},
};

export function getAccountCache(accountId: string, address: string) {
  return accountCache[`${accountId}:${address}`] ?? {};
}

export function updateAccountCache(accountId: string, address: string, partial: Partial<AccountCache>) {
  const key = `${accountId}:${address}`;
  accountCache[key] = { ...accountCache[key], ...partial };
}

export function setStakingCommonCache(data: ApiStakingCommonData) {
  stakingCommonCache = data;
}

export function getStakingCommonCache() {
  return stakingCommonCache;
}

export function getPricesCache() {
  return pricesCache;
}

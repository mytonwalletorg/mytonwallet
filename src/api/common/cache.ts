import type { ApiStakingCommonData } from '../types';

export type AccountCache = { stakedAt?: number };

let stakingCommonCache: ApiStakingCommonData;
const accountCache: Record<string, AccountCache> = {};

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

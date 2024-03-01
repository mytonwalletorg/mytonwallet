import type { ApiStakingCommonData } from '../types';

type Cache = { stakedAt?: number };

let stakingCommonCache: ApiStakingCommonData;
const accountCache: Record<string, Cache> = {};

export function getAccountCache(accountId: string, address: string) {
  return accountCache[`${accountId}:${address}`] ?? {};
}

export function updateAccountCache(accountId: string, address: string, partial: Partial<Cache>) {
  const key = `${accountId}:${address}`;
  accountCache[key] = { ...accountCache[key], ...partial };
}

export function setStakingCommonCache(data: ApiStakingCommonData) {
  stakingCommonCache = data;
}

export function getStakingCommonCache() {
  return stakingCommonCache;
}

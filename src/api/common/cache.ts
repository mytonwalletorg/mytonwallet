import type { ApiBackendConfig, ApiStakingCommonData } from '../types';

import Deferred from '../../util/Deferred';

export type AccountCache = { stakedAt?: number };

let stakingCommonCache: ApiStakingCommonData;

const accountCache: Record<string, AccountCache> = {};

let backendConfig: ApiBackendConfig | undefined;
const configDeferred = new Deferred();

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

export function setBackendConfigCache(config: ApiBackendConfig) {
  backendConfig = config;
  configDeferred.resolve();
}

/** Returns the config provided by the backend */
export async function getBackendConfigCache() {
  await configDeferred.promise;
  return backendConfig!;
}

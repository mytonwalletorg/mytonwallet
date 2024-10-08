import type { ApiChain } from '../api/types';

import { CHAIN_CONFIG } from '../config';

export function getChainConfig<T extends ApiChain>(chain: T) {
  return CHAIN_CONFIG[chain];
}

export function findChainConfig(chain: any) {
  return chain in CHAIN_CONFIG ? CHAIN_CONFIG[chain as ApiChain] : undefined;
}

import type { ApiChain, ApiToken } from '../api/types';

import { NATIVE_TOKENS, TONCOIN } from '../config';
import { getChainConfig } from './chain';

const nativeTokenSlugs = new Set<string>(NATIVE_TOKENS.map(({ slug }) => slug));

export function getIsNativeToken(slug?: string) {
  return slug ? nativeTokenSlugs.has(slug) : false;
}

export function getIsTonToken(slug: string, withNative?: boolean) {
  return Boolean(slug.startsWith('ton-') || (withNative && slug === TONCOIN.slug));
}

export function getNativeToken(chain: ApiChain): ApiToken {
  return getChainConfig(chain).nativeToken;
}

export function getTransactionHashFromTxId(chain: ApiChain, txId: string) {
  if (chain === 'tron') return txId;

  const [, transactionHash] = (txId || '').split(':');
  return transactionHash;
}

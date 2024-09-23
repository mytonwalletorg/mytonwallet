import type { ApiChain, ApiToken } from '../api/types';

import { getChainConfig, NATIVE_TOKENS } from '../config';

const nativeTokenSlugs = new Set<string>(NATIVE_TOKENS.map(({ slug }) => slug));

export function getIsNativeToken(slug?: string) {
  return slug ? nativeTokenSlugs.has(slug) : false;
}

export function getIsTonToken(slug: string) {
  const chain = 'ton';
  return slug.startsWith(`${chain}-`);
}

export function getNativeToken(chain: ApiChain): ApiToken {
  return getChainConfig(chain).nativeToken;
}

export function getTransactionHashFromTxId(chain: ApiChain, txId: string) {
  if (chain === 'tron') return txId;

  const [, transactionHash] = (txId || '').split(':');
  return transactionHash;
}

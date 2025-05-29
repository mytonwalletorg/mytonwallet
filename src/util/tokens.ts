import type { ApiChain, ApiToken, ApiTokenWithPrice } from '../api/types';
import type { UserToken } from '../global/types';

import { CHAIN_CONFIG, PRICELESS_TOKEN_HASHES, STAKED_TOKEN_SLUGS, TONCOIN } from '../config';
import { getChainConfig } from './chain';
import { pick } from './iteratees';

const chainByNativeSlug = Object.fromEntries(
  Object.entries(CHAIN_CONFIG).map(([chain, { nativeToken }]) => [nativeToken.slug, chain]),
) as Record<string, ApiChain>;

export function getIsNativeToken(slug?: string) {
  return slug ? slug in chainByNativeSlug : false;
}

export function getIsTonToken(slug: string, withNative?: boolean) {
  return Boolean(slug.startsWith('ton-') || (withNative && slug === TONCOIN.slug));
}

export function getNativeToken(chain: ApiChain): ApiToken {
  return getChainConfig(chain).nativeToken;
}

export function getChainBySlug(slug: string) {
  const items = slug.split('-');
  return items.length > 1 ? items[0] as ApiChain : chainByNativeSlug[slug];
}

export function getIsServiceToken(token?: ApiToken) {
  const { type, codeHash = '', slug = '' } = token ?? {};

  return type === 'lp_token'
    || STAKED_TOKEN_SLUGS.has(slug)
    || PRICELESS_TOKEN_HASHES.has(codeHash);
}

export function buildUserToken(token: ApiTokenWithPrice | ApiToken): UserToken {
  return {
    ...pick(token, [
      'symbol',
      'slug',
      'name',
      'image',
      'decimals',
      'keywords',
      'chain',
      'tokenAddress',
      'type',
    ]),
    amount: 0n,
    totalValue: '0',
    price: 0,
    priceUsd: 0,
    change24h: 0,
  };
}

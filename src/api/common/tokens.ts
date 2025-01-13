import type {
  ApiChain, ApiToken, ApiTokenWithPrice, OnApiUpdate,
} from '../types';

import { TOKEN_INFO } from '../../config';
import { tokenRepository } from '../db';
import { getPricesCache } from './cache';

const tokensCache = {
  ...TOKEN_INFO,
} as Record<string, ApiToken>;

export async function loadTokensCache() {
  const tokens = await tokenRepository.all();
  return addTokens(tokens);
}

export async function addTokens(tokens: ApiToken[], onUpdate?: OnApiUpdate, shouldForceSend?: boolean) {
  const newTokens: ApiToken[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const mergedToken = mergeTokenWithCache(token);

    if (!(token.slug in tokensCache)) {
      newTokens.push(mergedToken);
    }

    tokensCache[token.slug] = mergedToken;
    tokens[i] = mergedToken;
  }

  await tokenRepository.bulkPut(tokens);
  if ((shouldForceSend || newTokens.length) && onUpdate) {
    sendUpdateTokens(onUpdate);
  }
}

export function mergeTokenWithCache(token: ApiToken): ApiToken {
  const cacheToken = tokensCache[token.slug] || {};

  return { ...cacheToken, ...token };
}

export function getTokensCache() {
  return tokensCache;
}

export function getTokenBySlug(slug: string) {
  return getTokensCache()[slug];
}

export function getTokenByAddress(tokenAddress: string) {
  return getTokenBySlug(buildTokenSlug('ton', tokenAddress));
}

export function sendUpdateTokens(onUpdate: OnApiUpdate) {
  const tokens = getTokensCache();
  const prices = getPricesCache();

  const entries = Object.values(tokens).map((token) => {
    return [token.slug, {
      ...token,
      quote: prices.bySlug[token.slug] ?? {
        slug: token.slug,
        price: 0,
        priceUsd: 0,
        percentChange24h: 0,
      },
    }] as [string, ApiTokenWithPrice];
  });

  onUpdate({
    type: 'updateTokens',
    tokens: Object.fromEntries(entries),
    baseCurrency: prices.baseCurrency,
  });
}

export function buildTokenSlug(chain: ApiChain, address: string) {
  const addressPart = address.replace(/[^a-z\d]/gi, '').slice(0, 10);
  return `${chain}-${addressPart}`.toLowerCase();
}

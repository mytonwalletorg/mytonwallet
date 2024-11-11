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

  for (const token of tokens) {
    if (!(token.slug in tokensCache)) {
      newTokens.push(token);
    }
    tokensCache[token.slug] = token;
  }

  await tokenRepository.bulkPut(tokens);

  if ((shouldForceSend || newTokens.length) && onUpdate) {
    sendUpdateTokens(onUpdate);
  }
}

export function getTokensCache() {
  return tokensCache;
}

export function getTokenBySlug(slug: string) {
  return getTokensCache()[slug];
}

export function getTokenByAddress(tokenAddress: string) {
  return Object.values(tokensCache).find((token) => token.tokenAddress === tokenAddress);
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

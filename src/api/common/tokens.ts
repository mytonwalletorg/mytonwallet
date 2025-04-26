import type { ApiBaseCurrency, ApiChain, ApiTokenDetails, ApiTokenWithPrice, OnApiUpdate } from '../types';

import { DEFAULT_PRICE_CURRENCY, TOKEN_INFO } from '../../config';
import Deferred from '../../util/Deferred';
import { buildCollectionByKey, omitUndefined } from '../../util/iteratees';
import { tokenRepository } from '../db';

export const tokensPreload = new Deferred();
const tokensCache: {
  baseCurrency: ApiBaseCurrency;
  bySlug: Record<string, ApiTokenWithPrice>;
} = {
  baseCurrency: DEFAULT_PRICE_CURRENCY,
  bySlug: { ...TOKEN_INFO },
};

export async function loadTokensCache() {
  const tokens = await tokenRepository.all();
  await updateTokens(tokens);
  tokensPreload.resolve();
}

export async function updateTokens(
  tokens: ApiTokenWithPrice[],
  onUpdate?: OnApiUpdate,
  tokenDetails?: ApiTokenDetails[],
  baseCurrency?: ApiBaseCurrency,
  shouldSendUpdate?: boolean,
) {
  const tokensForDb: ApiTokenWithPrice[] = [];
  const detailsBySlug = buildCollectionByKey(tokenDetails ?? [], 'slug');

  for (const { slug, ...details } of tokenDetails ?? []) {
    const cachedToken = tokensCache.bySlug[slug] as ApiTokenWithPrice | undefined;
    if (cachedToken) {
      const token = { ...cachedToken, ...details };
      tokensCache.bySlug[slug] = token;
      tokensForDb.push(token);
    }
  }

  for (const token of tokens) {
    const { slug } = token;
    const cachedToken = tokensCache.bySlug[slug] as ApiTokenWithPrice | undefined;
    const mergedToken = mergeTokenWithCache(token, detailsBySlug, cachedToken);

    if (!(token.slug in tokensCache)) {
      shouldSendUpdate = true;
    }

    tokensCache.bySlug[token.slug] = mergedToken;
    if (token.tokenAddress) {
      tokensForDb.push(mergedToken);
    }
  }

  if (baseCurrency) {
    tokensCache.baseCurrency = baseCurrency;
  }

  await tokenRepository.bulkPut(tokensForDb);

  if (shouldSendUpdate && onUpdate) {
    sendUpdateTokens(onUpdate);
  }
}

function mergeTokenWithCache(
  token: ApiTokenWithPrice,
  detailsBySlug: Record<string, ApiTokenDetails>,
  cachedToken?: ApiTokenWithPrice,
): ApiTokenWithPrice {
  if (cachedToken) {
    // Metadata from backend takes priority (e.g., image)
    return {
      ...omitUndefined(token.isFromBackend ? token : cachedToken),
      ...omitUndefined(token.isFromBackend ? cachedToken : token),
      price: token.price || cachedToken.price,
      priceUsd: token.priceUsd || cachedToken.priceUsd,
      percentChange24h: token.percentChange24h || cachedToken.percentChange24h,
    };
  } else if (token.slug in detailsBySlug) {
    return {
      ...token,
      ...detailsBySlug[token.slug],
    };
  } else {
    return token;
  }
}

export function getTokensCache() {
  return tokensCache;
}

export function getTokenBySlug(slug: string) {
  return tokensCache.bySlug[slug];
}

export function getTokenByAddress(tokenAddress: string) {
  return getTokenBySlug(buildTokenSlug('ton', tokenAddress));
}

export function sendUpdateTokens(onUpdate: OnApiUpdate) {
  onUpdate({
    type: 'updateTokens',
    tokens: tokensCache.bySlug,
    baseCurrency: tokensCache.baseCurrency,
  });
}

export function buildTokenSlug(chain: ApiChain, address: string) {
  const addressPart = address.replace(/[^a-z\d]/gi, '').slice(0, 10);
  return `${chain}-${addressPart}`.toLowerCase();
}

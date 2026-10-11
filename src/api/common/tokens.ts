import {
  type ApiChain,
  type ApiTokenWithMaybePrice,
  type ApiTokenWithPrice,
  type OnApiUpdate,
} from '../types';

import { getTokenInfo } from '../../util/chain';
import Deferred from '../../util/Deferred';
import { omitUndefined } from '../../util/iteratees';
import { tokenRepository } from '../db';
import { callBackendGet } from './backend';

export type TokenUpdateOptions = {
  langCode?: string;
};

export const tokensPreload = new Deferred();
let isTokenUpdatePaused = false;
let arePricesFresh = false;
let pendingTokenUpdate: OnApiUpdate | undefined;
const tokensCache: {
  bySlug: Record<string, ApiTokenWithPrice>;
} = {
  bySlug: { ...getTokenInfo() },
};

export async function loadTokensCache() {
  try {
    const tokens = await tokenRepository.all();
    await updateTokens(tokens);
  } finally {
    tokensPreload.resolve();
  }
}

export async function updateTokensFromBackend(onUpdate: OnApiUpdate, options: TokenUpdateOptions = {}) {
  const { langCode } = options;
  const tokens = await callBackendGet<ApiTokenWithPrice[]>('/assets', { langCode });

  for (const token of tokens) {
    token.isFromBackend = true;
  }

  await tokensPreload.promise;

  await updateTokens(tokens, () => {
    arePricesFresh = true;
    sendUpdateTokens(onUpdate);
  }, true);
}

export async function updateTokens(
  tokens: ApiTokenWithMaybePrice[],
  sendUpdate?: NoneToVoidFunction,
  shouldSendUpdate?: boolean,
) {
  const tokensForDb: ApiTokenWithPrice[] = [];

  for (const token of tokens) {
    const { slug } = token;
    const cachedToken = tokensCache.bySlug[slug] as ApiTokenWithPrice | undefined;
    const mergedToken = mergeTokenWithCache(token, cachedToken);

    if (cachedToken === undefined) {
      shouldSendUpdate = true;
    }

    tokensCache.bySlug[token.slug] = mergedToken;
    if (token.tokenAddress) {
      tokensForDb.push(mergedToken);
    }
  }

  await tokenRepository.bulkPut(tokensForDb);

  if (shouldSendUpdate && sendUpdate) {
    sendUpdate();
  }
}

function mergeTokenWithCache(
  token: ApiTokenWithMaybePrice,
  cachedToken?: ApiTokenWithPrice,
): ApiTokenWithPrice {
  if (cachedToken) {
    // Metadata from backend takes priority (e.g., image)
    return {
      ...omitUndefined(token.isFromBackend ? cachedToken : token),
      ...omitUndefined(token.isFromBackend ? token : cachedToken),
      ...(token.isFromBackend && { localizedName: token.localizedName }),
      priceUsd: token.priceUsd ?? cachedToken.priceUsd,
      percentChange24h: token.percentChange24h ?? cachedToken.percentChange24h,
    };
  } else {
    return {
      ...token,
      priceUsd: token.priceUsd ?? 0,
      percentChange24h: token.percentChange24h ?? 0,
    };
  }
}

export function getTokensCache() {
  return tokensCache;
}

/** Note that this function may return `undefined` if the token is not found (e.g. pTON) */
export function getTokenBySlug(slug: string): ApiTokenWithPrice | undefined {
  return tokensCache.bySlug[slug];
}

export function getTokenByAddress(tokenAddress: string, chain?: ApiChain) {
  if (chain) return getTokenBySlug(buildTokenSlug(chain, tokenAddress));

  const normalizedAddress = normalizeTokenAddress(tokenAddress);
  const matches = Object.values(tokensCache.bySlug).filter((token) => {
    return token.tokenAddress && normalizeTokenAddress(token.tokenAddress) === normalizedAddress;
  });

  return matches.length === 1 ? matches[0] : undefined;
}

function normalizeTokenAddress(tokenAddress: string) {
  return tokenAddress.trim().toLowerCase();
}

export function sendUpdateTokens(onUpdate: OnApiUpdate) {
  if (isTokenUpdatePaused) {
    pendingTokenUpdate = onUpdate;
    return;
  }

  onUpdate({
    type: 'updateTokens',
    arePricesFresh,
    tokens: tokensCache.bySlug,
  });
}

export function pauseTokenUpdates() {
  isTokenUpdatePaused = true;
  arePricesFresh = false;
  pendingTokenUpdate = undefined;
}

export function resumeTokenUpdates() {
  isTokenUpdatePaused = false;

  const onUpdate = pendingTokenUpdate;
  pendingTokenUpdate = undefined;
  if (onUpdate) {
    sendUpdateTokens(onUpdate);
  }
}

// Full canonical address: a truncated one lets a look-alike token collide with a real one
export function buildTokenSlug(chain: ApiChain, address: string) {
  const trimmedAddress = address.trim();
  let normalizedAddress = trimmedAddress;
  try {
    // Lazy to avoid an import cycle with the chain SDKs
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { chains } = require('../chains') as typeof import('../chains');
    normalizedAddress = chains[chain].normalizeAddress(trimmedAddress);
  } catch {
    // Invalid address: keep it as is
  }
  return `${chain}-${normalizedAddress}`;
}

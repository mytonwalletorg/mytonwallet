import type { Storage } from '../storages/types';
import type {
  ApiBaseToken,
  ApiInitArgs,
  ApiToken,
  ApiTokenPrice,
  ApiTransaction,
  ApiTxIdBySlug,
  OnApiUpdate,
} from '../types';

import {
  APP_VERSION,
  BRILLIANT_API_BASE_URL,
  TON_TOKEN_SLUG,
} from '../../config';
import { logDebugError } from '../../util/logs';
import { pause } from '../../util/schedulers';
import blockchains from '../blockchains';
import type { TokenBalanceParsed } from '../blockchains/ton/tokens';
import { addKnownTokens, getKnownTokens } from '../blockchains/ton/tokens';
import { tryUpdateKnownAddresses } from '../common/addresses';
import { compareTransactions, isUpdaterAlive, resolveBlockchainKey } from '../common/helpers';
import { txCallbacks } from '../common/txCallbacks';
import { getBackendStakingState } from './staking';

type IsAccountActiveFn = (accountId: string) => boolean;

const POLLING_INTERVAL = 1100; // 1.1 sec
const BACKEND_POLLING_INTERVAL = 30000; // 30 sec
const LONG_BACKEND_POLLING_INTERVAL = 60000; // 1 min
const TRANSACTIONS_WAITING_PAUSE = 2000; // 2 sec

const FIRST_TRANSACTIONS_LIMIT = 20;

let onUpdate: OnApiUpdate;
let storage: Storage;
let isAccountActive: IsAccountActiveFn;
let origin: string;

let preloadEnsurePromise: Promise<any>;
let pricesBySlug: Record<string, ApiTokenPrice>;

const lastBalanceCache: Record<string, {
  balance?: string;
  tokenBalances?: Record<string, string>;
}> = {};

export function initPolling(
  _onUpdate: OnApiUpdate, _storage: Storage, _isAccountActive: IsAccountActiveFn, args: ApiInitArgs,
) {
  onUpdate = _onUpdate;
  storage = _storage;
  isAccountActive = _isAccountActive;
  origin = args.origin;

  preloadEnsurePromise = Promise.all([
    tryUpdateKnownAddresses(),
    tryUpdateTokens(),
  ]);

  void setupBackendPolling();
  void setupLongBackendPolling();
}

function registerNewTokens(tokenBalances: TokenBalanceParsed[]) {
  const tokens = getKnownTokens();
  let areNewTokensFound = false;

  for (const { token } of tokenBalances.filter(Boolean)) {
    if (token.slug in tokens) continue;

    areNewTokensFound = true;
    tokens[token.slug] = {
      ...token,
      quote: pricesBySlug[token.slug] || {
        price: 0.0,
        percentChange1h: 0.0,
        percentChange24h: 0.0,
        percentChange7d: 0.0,
        percentChange30d: 0.0,
      },
    } as ApiToken;
  }

  if (areNewTokensFound) {
    sendUpdateTokens();
  }
}

export async function setupBalancePolling(accountId: string, newestTxIds: ApiTxIdBySlug = {}) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  delete lastBalanceCache[accountId];

  let isFirstRun = true;
  while (isUpdaterAlive(onUpdate) && isAccountActive(accountId)) {
    try {
      const [balance, tokenBalances, stakingState] = await Promise.all([
        blockchain.getAccountBalance(storage, accountId).catch(logAndRescue),
        blockchain.getAccountTokenBalances(storage, accountId).catch(logAndRescue),
        blockchain.getStakingState(storage, accountId).catch(logAndRescue),
      ]);
      if (!isUpdaterAlive(onUpdate) || !isAccountActive(accountId)) return;

      const cache = lastBalanceCache[accountId];
      const changedTokenSlugs: string[] = [];

      if (balance && balance !== cache?.balance) {
        changedTokenSlugs.push(TON_TOKEN_SLUG);
        onUpdate({
          type: 'updateBalance',
          accountId,
          slug: TON_TOKEN_SLUG,
          balance,
        });

        lastBalanceCache[accountId] = {
          ...lastBalanceCache[accountId],
          balance,
        };
      }

      if (tokenBalances) {
        registerNewTokens(tokenBalances);

        // Process balances
        for (const { slug, balance: tokenBalance } of tokenBalances) {
          const cachedBalance = cache?.tokenBalances && cache.tokenBalances[slug];
          if (cachedBalance === tokenBalance) continue;

          changedTokenSlugs.push(slug);

          onUpdate({
            type: 'updateBalance',
            accountId,
            slug,
            balance: tokenBalance,
          });
        }

        lastBalanceCache[accountId] = {
          ...lastBalanceCache[accountId],
          tokenBalances: Object.fromEntries(tokenBalances.map(
            ({ slug, balance: tokenBalance }) => [slug, tokenBalance],
          )),
        };
      }

      if (stakingState) {
        onUpdate({
          type: 'updateStakingState',
          accountId,
          stakingState,
        });
      }

      if (changedTokenSlugs.length) {
        if (!isFirstRun) {
          await pause(TRANSACTIONS_WAITING_PAUSE);
        }
        const newTxIds = await processNewTokenTransactions(accountId, newestTxIds, changedTokenSlugs);
        newestTxIds = { ...newestTxIds, ...newTxIds };
      }

      isFirstRun = false;
    } catch (err) {
      logDebugError('setupBalancePolling', err);
    }

    await pause(POLLING_INTERVAL);
  }
}

async function processNewTokenTransactions(
  accountId: string,
  newestTxIds: ApiTxIdBySlug,
  tokenSlugs: string[],
): Promise<ApiTxIdBySlug> {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  if (!tokenSlugs.length) {
    return {};
  }

  let allTransactions: ApiTransaction[] = [];

  const entries = await Promise.all(tokenSlugs.map(async (slug) => {
    let newestTxId = newestTxIds[slug];

    const transactions = await blockchain.getTokenTransactionSlice(
      storage, accountId, slug, undefined, newestTxId,
    );

    if (transactions.length) {
      newestTxId = transactions[0]!.txId;
      allTransactions = allTransactions.concat(transactions.slice(0, FIRST_TRANSACTIONS_LIMIT));
    }
    return [slug, newestTxId];
  }));

  allTransactions.sort((a, b) => compareTransactions(a, b, true));

  allTransactions.forEach((transaction) => {
    txCallbacks.runCallbacks(transaction);
  });

  onUpdate({
    type: 'newTransactions',
    transactions: allTransactions,
    accountId,
  });

  return Object.fromEntries(entries);
}

export async function setupBackendPolling() {
  while (isUpdaterAlive(onUpdate)) {
    await pause(BACKEND_POLLING_INTERVAL);

    try {
      await tryUpdateTokens();
    } catch (err) {
      logDebugError('setupBackendPolling', err);
    }
  }
}

export async function setupLongBackendPolling() {
  while (isUpdaterAlive(onUpdate)) {
    await pause(LONG_BACKEND_POLLING_INTERVAL);

    try {
      await tryUpdateKnownAddresses();
    } catch (err) {
      logDebugError('setupLongBackendPolling', err);
    }
  }
}

export async function tryUpdateTokens() {
  try {
    const [pricesRes, tokensRes] = await Promise.all([
      fetch(`${BRILLIANT_API_BASE_URL}/prices`, {
        headers: { 'X-App-Origin': origin, 'X-App-Version': APP_VERSION },
      }),
      fetch(`${BRILLIANT_API_BASE_URL}/known-tokens`),
    ]);
    if (!pricesRes.ok || !tokensRes.ok) return;

    const [pricesData, tokens] = await Promise.all([
      pricesRes.json() as Promise<Record<string, { slugs: string[]; quote: ApiTokenPrice }>>,
      tokensRes.json() as Promise<ApiBaseToken[]>,
    ]);

    if (!isUpdaterAlive(onUpdate)) return;

    addKnownTokens(tokens);

    pricesBySlug = Object.values(pricesData).reduce((acc, { slugs, quote }) => {
      for (const slug of slugs) {
        acc[slug] = quote;
      }
      return acc;
    }, {} as Record<string, ApiTokenPrice>);

    sendUpdateTokens();
  } catch (err) {
    logDebugError('tryUpdateTokens', err);
  }
}

export function sendUpdateTokens() {
  const tokens = getKnownTokens();
  Object.values(tokens).forEach((token) => {
    if (token.slug in pricesBySlug) {
      token.quote = pricesBySlug[token.slug];
    }
  });

  onUpdate({
    type: 'updateTokens',
    tokens,
  });
}

export async function setupBackendStakingStatePolling(accountId: string) {
  while (isUpdaterAlive(onUpdate) && isAccountActive(accountId)) {
    try {
      const backendStakingState = await getBackendStakingState(accountId);
      if (!isUpdaterAlive(onUpdate) || !isAccountActive(accountId)) return;

      if (backendStakingState) {
        onUpdate({
          type: 'updateBackendStakingState',
          backendStakingState,
        });
      }
    } catch (err) {
      logDebugError('setupBackendStakingStatePolling', err);
    }

    await pause(BACKEND_POLLING_INTERVAL);
  }
}

function logAndRescue(err: Error) {
  logDebugError('Polling error', err);

  return undefined;
}

export async function waitDataPreload() {
  await preloadEnsurePromise;
}

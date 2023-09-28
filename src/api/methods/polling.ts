import { randomBytes } from 'tweetnacl';

import type { TokenBalanceParsed } from '../blockchains/ton/tokens';
import type {
  ApiBaseToken,
  ApiNftUpdate,
  ApiToken,
  ApiTokenPrice,
  ApiTransactionActivity,
  ApiTxIdBySlug,
  OnApiUpdate,
} from '../types';

import { APP_ENV, APP_VERSION, TON_TOKEN_SLUG } from '../../config';
import { compareActivities } from '../../util/compareActivities';
import { logDebugError } from '../../util/logs';
import { pause } from '../../util/schedulers';
import blockchains from '../blockchains';
import { addKnownTokens, getKnownTokens } from '../blockchains/ton/tokens';
import { tryUpdateKnownAddresses } from '../common/addresses';
import { callBackendGet } from '../common/backend';
import { isUpdaterAlive, resolveBlockchainKey } from '../common/helpers';
import { txCallbacks } from '../common/txCallbacks';
import { X_APP_ORIGIN } from '../environment';
import { storage } from '../storages';
import { getBackendStakingState } from './staking';

type IsAccountActiveFn = (accountId: string) => boolean;

const POLLING_INTERVAL = 1100; // 1.1 sec
const BACKEND_POLLING_INTERVAL = 30000; // 30 sec
const LONG_BACKEND_POLLING_INTERVAL = 60000; // 1 min
const PAUSE_AFTER_BALANCE_CHANGE = 1000; // 1 sec
const FIRST_TRANSACTIONS_LIMIT = 20;
const NFT_FULL_POLLING_INTERVAL = 30000; // 30 sec
const NFT_FULL_UPDATE_FREQUNCY = Math.round(NFT_FULL_POLLING_INTERVAL / POLLING_INTERVAL);
const DOUBLE_CHECK_TOKENS_PAUSE = 30000; // 30 sec

let onUpdate: OnApiUpdate;
let isAccountActive: IsAccountActiveFn;
let clientId: string | undefined;

let preloadEnsurePromise: Promise<any>;
let pricesBySlug: Record<string, ApiTokenPrice> = {};

const lastBalanceCache: Record<string, {
  balance?: string;
  tokenBalances?: Record<string, string>;
}> = {};

export function initPolling(_onUpdate: OnApiUpdate, _isAccountActive: IsAccountActiveFn) {
  onUpdate = _onUpdate;
  isAccountActive = _isAccountActive;

  preloadEnsurePromise = Promise.all([
    tryUpdateKnownAddresses(),
    tryUpdateTokens(_onUpdate),
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

export async function setupBalanceBasedPolling(accountId: string, newestTxIds: ApiTxIdBySlug = {}) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  delete lastBalanceCache[accountId];

  let nftFromSec = Math.round(Date.now() / 1000);
  let nftUpdates: ApiNftUpdate[];
  let i = 0;
  let doubleCheckTokensTime: number | undefined;

  const localOnUpdate = onUpdate;

  while (isUpdaterAlive(localOnUpdate) && isAccountActive(accountId)) {
    try {
      const [balance, stakingState] = await Promise.all([
        blockchain.getAccountBalance(accountId).catch(logAndRescue),
        blockchain.getStakingState(accountId).catch(logAndRescue),
      ]);
      if (!isUpdaterAlive(localOnUpdate) || !isAccountActive(accountId)) return;

      if (stakingState) {
        onUpdate({
          type: 'updateStakingState',
          accountId,
          stakingState,
        });
      }

      // Full update NFTs every ~30 seconds
      if (i % NFT_FULL_UPDATE_FREQUNCY === 0) {
        nftFromSec = Math.round(Date.now() / 1000);
        const nfts = await blockchain.getAccountNfts(accountId);
        if (!isUpdaterAlive(localOnUpdate) || !isAccountActive(accountId)) return;

        onUpdate({
          type: 'updateNfts',
          accountId,
          nfts,
        });
      }

      // Process TON balance
      const cache = lastBalanceCache[accountId];
      const changedTokenSlugs: string[] = [];
      const isTonBalanceChanged = balance && balance !== cache?.balance;

      if (isTonBalanceChanged) {
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

        await pause(PAUSE_AFTER_BALANCE_CHANGE);
      }

      // Fetch and process token balances
      if (isTonBalanceChanged || (doubleCheckTokensTime && doubleCheckTokensTime < Date.now())) {
        doubleCheckTokensTime = isTonBalanceChanged ? Date.now() + DOUBLE_CHECK_TOKENS_PAUSE : undefined;

        const tokenBalances = await blockchain.getAccountTokenBalances(accountId).catch(logAndRescue);
        if (!isUpdaterAlive(localOnUpdate) || !isAccountActive(accountId)) return;

        if (tokenBalances) {
          registerNewTokens(tokenBalances);

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
      }

      // Fetch transactions for tokens with a changed balance
      if (changedTokenSlugs.length) {
        const newTxIds = await processNewTokenActivities(accountId, newestTxIds, changedTokenSlugs);
        newestTxIds = { ...newestTxIds, ...newTxIds };
      }

      // Fetch NFT updates
      if (isTonBalanceChanged) {
        [nftFromSec, nftUpdates] = await blockchain.getNftUpdates(accountId, nftFromSec);
        if (!isUpdaterAlive(localOnUpdate) || !isAccountActive(accountId)) return;
        nftUpdates.forEach(onUpdate);
      }

      i++;
    } catch (err) {
      logDebugError('setupBalancePolling', err);
    }

    await pause(POLLING_INTERVAL);
  }
}

async function processNewTokenActivities(
  accountId: string,
  newestTxIds: ApiTxIdBySlug,
  tokenSlugs: string[],
): Promise<ApiTxIdBySlug> {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  if (!tokenSlugs.length) {
    return {};
  }

  let allTransactions: ApiTransactionActivity[] = [];

  const entries = await Promise.all(tokenSlugs.map(async (slug) => {
    let newestTxId = newestTxIds[slug];

    const transactions = await blockchain.getTokenTransactionSlice(
      accountId, slug, undefined, newestTxId,
    );

    if (transactions.length) {
      newestTxId = transactions[0]!.txId;
      allTransactions = allTransactions.concat(transactions.slice(0, FIRST_TRANSACTIONS_LIMIT));
    }
    return [slug, newestTxId];
  }));

  allTransactions.sort((a, b) => compareActivities(a, b, true));

  allTransactions.forEach((transaction) => {
    txCallbacks.runCallbacks(transaction);
  });

  const activities = allTransactions;

  onUpdate({
    type: 'newActivities',
    activities,
    accountId,
  });

  return Object.fromEntries(entries);
}

export async function setupBackendPolling() {
  const localOnUpdate = onUpdate;

  while (isUpdaterAlive(localOnUpdate)) {
    await pause(BACKEND_POLLING_INTERVAL);
    if (!isUpdaterAlive(localOnUpdate)) return;

    try {
      await tryUpdateTokens(localOnUpdate);
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

export async function tryUpdateTokens(localOnUpdate: OnApiUpdate) {
  try {
    const [pricesData, tokens] = await Promise.all([
      callBackendGet('/prices', undefined, {
        'X-App-Origin': X_APP_ORIGIN,
        'X-App-Version': APP_VERSION,
        'X-App-ClientID': clientId ?? await getClientId(),
        'X-App-Env': APP_ENV,
      }) as Promise<Record<string, { slugs: string[]; quote: ApiTokenPrice }>>,
      callBackendGet('/known-tokens') as Promise<ApiBaseToken[]>,
    ]);

    if (!isUpdaterAlive(localOnUpdate)) return;

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

async function getClientId() {
  clientId = await storage.getItem('clientId');
  if (!clientId) {
    clientId = Buffer.from(randomBytes(10)).toString('hex');
    await storage.setItem('clientId', clientId);
  }
  return clientId;
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

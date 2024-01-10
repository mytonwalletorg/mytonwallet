import { randomBytes } from 'tweetnacl';

import type { TokenBalanceParsed } from '../blockchains/ton/tokens';
import type {
  ApiActivity,
  ApiBackendStakingState,
  ApiBaseCurrency,
  ApiBaseToken,
  ApiNftUpdate,
  ApiStakingCommonData,
  ApiStakingState,
  ApiSwapAsset,
  ApiSwapHistoryItem,
  ApiToken,
  ApiTokenPrice,
  ApiTransactionActivity,
  ApiTxIdBySlug,
  OnApiUpdate,
} from '../types';

import {
  APP_ENV, APP_VERSION, DEFAULT_PRICE_CURRENCY, TON_TOKEN_SLUG,
} from '../../config';
import { parseAccountId } from '../../util/account';
import { areDeepEqual } from '../../util/areDeepEqual';
import { compareActivities } from '../../util/compareActivities';
import { buildCollectionByKey } from '../../util/iteratees';
import { logDebugError } from '../../util/logs';
import { pause } from '../../util/schedulers';
import blockchains from '../blockchains';
import { addKnownTokens, getKnownTokens } from '../blockchains/ton/tokens';
import { fetchStoredAccount, updateStoredAccount } from '../common/accounts';
import { tryUpdateKnownAddresses } from '../common/addresses';
import { callBackendGet } from '../common/backend';
import { isUpdaterAlive, resolveBlockchainKey } from '../common/helpers';
import { txCallbacks } from '../common/txCallbacks';
import { getEnvironment } from '../environment';
import { storage } from '../storages';
import { processNftUpdates, updateNfts } from './nfts';
import { getBaseCurrency } from './prices';
import { getBackendStakingState, getStakingCommonData, tryUpdateStakingCommonData } from './staking';
import {
  swapGetAssets, swapGetHistory, swapItemToActivity, swapReplaceTransactions,
} from './swap';

type IsAccountActiveFn = (accountId: string) => boolean;

const POLLING_INTERVAL = 1100; // 1.1 sec
const BACKEND_POLLING_INTERVAL = 30000; // 30 sec
const LONG_BACKEND_POLLING_INTERVAL = 60000; // 1 min

const FIRST_TRANSACTIONS_LIMIT = 50;

const NFT_FULL_POLLING_INTERVAL = 30000; // 30 sec
const NFT_FULL_UPDATE_FREQUNCY = Math.round(NFT_FULL_POLLING_INTERVAL / POLLING_INTERVAL);
const DOUBLE_CHECK_TOKENS_PAUSE = 30000; // 30 sec

const SWAP_POLLING_INTERVAL = 3000; // 3 sec
const SWAP_FINISHED_STATUSES = new Set(['failed', 'completed', 'expired']);

let onUpdate: OnApiUpdate;
let isAccountActive: IsAccountActiveFn;
let clientId: string | undefined;

let preloadEnsurePromise: Promise<any>;
const prices: {
  baseCurrency: ApiBaseCurrency;
  bySlug: Record<string, ApiTokenPrice>;
} = {
  baseCurrency: DEFAULT_PRICE_CURRENCY,
  bySlug: {},
};
let swapPollingAccountId: string | undefined;
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
    tryLoadSwapTokens(_onUpdate),
    tryUpdateStakingCommonData(),
    tryUpdateRegion(_onUpdate),
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
      quote: prices.bySlug[token.slug] || {
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

  const { network } = parseAccountId(accountId);
  const account = await fetchStoredAccount(accountId);
  const { address } = account;
  let { isInitialized } = account;

  let nftFromSec = Math.round(Date.now() / 1000);
  let nftUpdates: ApiNftUpdate[];
  let i = 0;
  let doubleCheckTokensTime: number | undefined;
  let tokenBalances: TokenBalanceParsed[] | undefined;

  const localOnUpdate = onUpdate;

  while (isUpdaterAlive(localOnUpdate) && isAccountActive(accountId)) {
    try {
      const walletInfo = await blockchain.getWalletInfo(network, address);
      if (!isUpdaterAlive(localOnUpdate) || !isAccountActive(accountId)) return;

      const { balance, lastTxId } = walletInfo ?? {};

      // Full update NFTs every ~30 seconds
      if (i % NFT_FULL_UPDATE_FREQUNCY === 0) {
        const nfts = await blockchain.getAccountNfts(accountId).catch(logAndRescue);
        if (!isUpdaterAlive(localOnUpdate) || !isAccountActive(accountId)) return;

        if (nfts) {
          nftFromSec = Math.round(Date.now() / 1000);
          if (!isUpdaterAlive(localOnUpdate) || !isAccountActive(accountId)) return;

          void updateNfts(accountId, nfts);
        }
      }

      // Process TON balance
      const cache = lastBalanceCache[accountId];
      const changedTokenSlugs: string[] = [];
      const isTonBalanceChanged = balance && balance !== cache?.balance;

      const balancesToUpdate: Record<string, string> = {};

      if (isTonBalanceChanged) {
        balancesToUpdate[TON_TOKEN_SLUG] = balance;

        lastBalanceCache[accountId] = {
          ...lastBalanceCache[accountId],
          balance,
        };
      }

      // Fetch and process token balances
      if (isTonBalanceChanged || (doubleCheckTokensTime && doubleCheckTokensTime < Date.now())) {
        doubleCheckTokensTime = isTonBalanceChanged ? Date.now() + DOUBLE_CHECK_TOKENS_PAUSE : undefined;

        tokenBalances = await blockchain.getAccountTokenBalances(accountId).catch(logAndRescue);

        if (!isUpdaterAlive(localOnUpdate) || !isAccountActive(accountId)) return;

        if (tokenBalances) {
          registerNewTokens(tokenBalances);

          tokenBalances.forEach(({ slug, balance: tokenBalance }) => {
            const cachedBalance = cache?.tokenBalances && cache.tokenBalances[slug];
            if (cachedBalance === tokenBalance) return;

            changedTokenSlugs.push(slug);
            balancesToUpdate[slug] = tokenBalance;
          });

          lastBalanceCache[accountId] = {
            ...lastBalanceCache[accountId],
            tokenBalances: Object.fromEntries(tokenBalances.map(
              ({ slug, balance: tokenBalance }) => [slug, tokenBalance],
            )),
          };
        }

        if (Object.keys(balancesToUpdate).length > 0) {
          onUpdate({
            type: 'updateBalances',
            accountId,
            balancesToUpdate,
          });
        }
      }

      // Fetch transactions for tokens with a changed balance
      if (isTonBalanceChanged || changedTokenSlugs.length) {
        if (lastTxId) {
          await blockchain.waitUntilTransactionAppears(network, address, lastTxId);
        }

        const newTxIds = await processNewActivities(accountId, newestTxIds, changedTokenSlugs, tokenBalances);
        newestTxIds = { ...newestTxIds, ...newTxIds };
      }

      // Fetch NFT updates
      if (isTonBalanceChanged) {
        const nftResult = await blockchain.getNftUpdates(accountId, nftFromSec).catch(logAndRescue);
        if (!isUpdaterAlive(localOnUpdate) || !isAccountActive(accountId)) return;

        if (nftResult) {
          [nftFromSec, nftUpdates] = nftResult;
          void processNftUpdates(accountId, nftUpdates);
        }
      }

      if (isTonBalanceChanged && !isInitialized && await blockchain.isAddressInitialized(network, address)) {
        isInitialized = true;
        await updateStoredAccount(accountId, { isInitialized });
      }

      i++;
    } catch (err) {
      logDebugError('setupBalancePolling', err);
    }

    await pause(POLLING_INTERVAL);
  }
}

export async function setupStakingPolling(accountId: string) {
  const { blockchain: blockchainKey, network } = parseAccountId(accountId);
  const blockchain = blockchains[blockchainKey];

  if (network !== 'mainnet') {
    return;
  }

  const localOnUpdate = onUpdate;
  let lastState: {
    stakingCommonData: ApiStakingCommonData;
    backendStakingState: ApiBackendStakingState;
    stakingState: ApiStakingState;
  } | undefined;

  while (isUpdaterAlive(localOnUpdate) && isAccountActive(accountId)) {
    try {
      const stakingCommonData = getStakingCommonData();
      const backendStakingState = await getBackendStakingState(accountId);
      const stakingState = await blockchain.getStakingState(
        accountId, stakingCommonData, backendStakingState,
      );

      if (!isUpdaterAlive(localOnUpdate) || !isAccountActive(accountId)) return;

      const state = {
        stakingCommonData,
        backendStakingState,
        stakingState,
      };

      if (!areDeepEqual(state, lastState)) {
        lastState = state;
        onUpdate({
          type: 'updateStaking',
          accountId,
          ...state,
        });
      }
    } catch (err) {
      logDebugError('setupBalancePolling', err);
    }

    await pause(POLLING_INTERVAL);
  }
}

async function processNewActivities(
  accountId: string,
  newestTxIds: ApiTxIdBySlug,
  tokenSlugs: string[],
  tokenBalances?: TokenBalanceParsed[],
): Promise<ApiTxIdBySlug> {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  let allTransactions: ApiTransactionActivity[] = [];
  let allActivities: ApiActivity[] = [];

  const result: [string, string | undefined][] = [];

  // Process TON transactions first
  {
    const slug = TON_TOKEN_SLUG;
    let newestTxId = newestTxIds[slug];

    const transactions = await blockchain.getTokenTransactionSlice(
      accountId, slug, undefined, newestTxId, FIRST_TRANSACTIONS_LIMIT,
    );
    const activities = await swapReplaceTransactions(accountId, transactions, slug);

    if (transactions.length) {
      newestTxId = transactions[0]!.txId;

      allActivities = allActivities.concat(activities);
      allTransactions = allTransactions.concat(transactions);
    }

    result.push([slug, newestTxId]);

    // Find affected token wallets
    const tokenBalanceByAddress = buildCollectionByKey(tokenBalances ?? [], 'jettonWallet');
    transactions.forEach(({ isIncoming, toAddress, fromAddress }) => {
      const address = isIncoming ? fromAddress : toAddress;
      const tokenBalance: TokenBalanceParsed | undefined = tokenBalanceByAddress[address];

      if (tokenBalance && !tokenSlugs.includes(tokenBalance.slug)) {
        tokenSlugs = tokenSlugs.concat([tokenBalance.slug]);
      }
    });
  }

  await Promise.all(tokenSlugs.map(async (slug) => {
    let newestTxId = newestTxIds[slug];

    const transactions = await blockchain.getTokenTransactionSlice(
      accountId, slug, undefined, newestTxId, FIRST_TRANSACTIONS_LIMIT,
    );
    const activities = await swapReplaceTransactions(accountId, transactions, slug);

    if (transactions.length) {
      newestTxId = transactions[0]!.txId;

      allActivities = allActivities.concat(activities);
      allTransactions = allTransactions.concat(transactions);
    }

    result.push([slug, newestTxId]);
  }));

  allTransactions.sort((a, b) => compareActivities(a, b, true));

  allTransactions.forEach((transaction) => {
    txCallbacks.runCallbacks(transaction);
  });

  onUpdate({
    type: 'newActivities',
    activities: allActivities,
    accountId,
  });

  return Object.fromEntries(result);
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
  const localOnUpdate = onUpdate;

  while (isUpdaterAlive(localOnUpdate)) {
    await pause(LONG_BACKEND_POLLING_INTERVAL);

    await Promise.all([
      tryUpdateKnownAddresses(),
      tryUpdateStakingCommonData(),
      tryUpdateRegion(localOnUpdate),
    ]);
  }
}

export async function tryUpdateTokens(localOnUpdate?: OnApiUpdate) {
  if (!localOnUpdate) {
    localOnUpdate = onUpdate;
  }

  try {
    const baseCurrency = await getBaseCurrency();
    const pricesHeaders: AnyLiteral = {
      ...getEnvironment().apiHeaders,
      'X-App-Version': APP_VERSION,
      'X-App-ClientID': clientId ?? await getClientId(),
      'X-App-Env': APP_ENV,
    };

    const [pricesData, tokens] = await Promise.all([
      callBackendGet<Record<string, {
        slugs: string[];
        quote: ApiTokenPrice;
      }>>('/prices', { base: baseCurrency }, pricesHeaders),
      callBackendGet<ApiBaseToken[]>('/known-tokens'),
    ]);

    if (!isUpdaterAlive(localOnUpdate)) return;

    addKnownTokens(tokens);

    prices.bySlug = Object.values(pricesData).reduce((acc, { slugs, quote }) => {
      for (const slug of slugs) {
        acc[slug] = quote;
      }
      return acc;
    }, {} as Record<string, ApiTokenPrice>);
    prices.baseCurrency = baseCurrency;

    sendUpdateTokens();
  } catch (err) {
    logDebugError('tryUpdateTokens', err);
  }
}

export async function tryLoadSwapTokens(localOnUpdate: OnApiUpdate) {
  try {
    const assets = await swapGetAssets();

    if (!isUpdaterAlive(localOnUpdate)) return;

    const tokens = assets.reduce((acc: Record<string, ApiSwapAsset>, asset) => {
      acc[asset.slug] = {
        ...asset,
        contract: asset.contract ?? asset.slug,
      };
      return acc;
    }, {});

    onUpdate({
      type: 'updateSwapTokens',
      tokens,
    });
  } catch (err) {
    logDebugError('tryLoadSwapTokens', err);
  }
}

export async function tryUpdateRegion(localOnUpdate: OnApiUpdate) {
  try {
    const { isLimited } = await callBackendGet<{ isLimited: boolean }>('/utils/check-region');

    if (!isUpdaterAlive(localOnUpdate)) return;

    onUpdate({
      type: 'updateRegion',
      isLimited,
    });
  } catch (err) {
    logDebugError('tryUpdateRegion', err);
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
    if (token.slug in prices.bySlug) {
      token.quote = prices.bySlug[token.slug];
    }
  });

  onUpdate({
    type: 'updateTokens',
    tokens,
    baseCurrency: prices.baseCurrency,
  });
}

export async function setupSwapPolling(accountId: string) {
  if (swapPollingAccountId === accountId) return; // Double launch is not allowed
  swapPollingAccountId = accountId;

  const { address, lastFinishedSwapTimestamp } = await fetchStoredAccount(accountId);

  let fromTimestamp = lastFinishedSwapTimestamp ?? await getActualLastFinishedSwapTimestamp(accountId, address);

  const localOnUpdate = onUpdate;
  const swapById: Record<string, ApiSwapHistoryItem> = {};

  while (isUpdaterAlive(localOnUpdate) && isAccountActive(accountId)) {
    try {
      const swaps = await swapGetHistory(address, {
        fromTimestamp,
      });
      if (!isUpdaterAlive(onUpdate) || !isAccountActive(accountId)) break;
      if (!swaps.length) break;

      swaps.reverse();

      let isLastFinishedSwapUpdated = false;
      let isPrevFinished = true;

      for (const swap of swaps) {
        if (swap.cex) {
          if (swap.cex.status === swapById[swap.id]?.cex!.status) {
            continue;
          }
        } else if (swap.status === swapById[swap.id]?.status) {
          continue;
        }

        swapById[swap.id] = swap;

        const isFinished = SWAP_FINISHED_STATUSES.has(swap.status);
        if (isFinished && isPrevFinished) {
          fromTimestamp = swap.timestamp;
          isLastFinishedSwapUpdated = true;
        }
        isPrevFinished = isFinished;

        if (!swap.cex && swap.status !== 'completed') {
          // Completed onchain swaps are processed in swapReplaceTransactions
          onUpdate({
            type: 'newActivities',
            accountId,
            activities: [swapItemToActivity(swap)],
          });
        }
      }

      if (isLastFinishedSwapUpdated) {
        await updateStoredAccount(accountId, {
          lastFinishedSwapTimestamp: fromTimestamp,
        });
      }
    } catch (err) {
      logDebugError('setupSwapCexPolling', err);
    }

    await pause(SWAP_POLLING_INTERVAL);
  }

  if (accountId === swapPollingAccountId) {
    swapPollingAccountId = undefined;
  }
}

async function getActualLastFinishedSwapTimestamp(accountId: string, address: string) {
  const swaps = await swapGetHistory(address, {});

  swaps.reverse();

  let timestamp = Date.now();
  for (const swap of swaps) {
    if (SWAP_FINISHED_STATUSES.has(swap.status)) {
      timestamp = swap.timestamp;
    } else {
      break;
    }
  }

  await updateStoredAccount(accountId, {
    lastFinishedSwapTimestamp: timestamp,
  });

  return timestamp;
}

function logAndRescue(err: Error) {
  logDebugError('Polling error', err);

  return undefined;
}

export async function waitDataPreload() {
  await preloadEnsurePromise;
}

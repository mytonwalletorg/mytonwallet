import type { TokenBalanceParsed } from '../blockchains/ton/tokens';
import type {
  ApiBackendStakingState,
  ApiBalanceBySlug,
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
  ApiWalletInfo,
  OnApiUpdate,
} from '../types';

import { DEFAULT_PRICE_CURRENCY, POPULAR_WALLET_VERSIONS, TON_TOKEN_SLUG } from '../../config';
import { parseAccountId } from '../../util/account';
import { areDeepEqual } from '../../util/areDeepEqual';
import { compareActivities } from '../../util/compareActivities';
import { buildCollectionByKey } from '../../util/iteratees';
import { logDebugError } from '../../util/logs';
import { pauseOrFocus } from '../../util/pauseOrFocus';
import blockchains from '../blockchains';
import { addKnownTokens, getKnownTokens } from '../blockchains/ton/tokens';
import { fetchStoredAccount, updateStoredAccount } from '../common/accounts';
import { tryUpdateKnownAddresses } from '../common/addresses';
import { callBackendGet } from '../common/backend';
import { getStakingCommonCache } from '../common/cache';
import { isUpdaterAlive, resolveBlockchainKey } from '../common/helpers';
import { txCallbacks } from '../common/txCallbacks';
import { hexToBytes } from '../common/utils';
import { processNftUpdates, updateNfts } from './nfts';
import { resolveDataPreloadPromise } from './preload';
import { getBaseCurrency } from './prices';
import { getBackendStakingState, tryUpdateStakingCommonData } from './staking';
import {
  swapGetAssets, swapGetHistory, swapItemToActivity, swapReplaceTransactionsByRanges,
} from './swap';

type IsAccountActiveFn = (accountId: string) => boolean;

const SEC = 1000;
const BALANCE_BASED_INTERVAL = 1.1 * SEC;
const BALANCE_BASED_INTERVAL_WHEN_NOT_FOCUSED = 10 * SEC;
const STAKING_INTERVAL = 1.1 * SEC;
const STAKING_INTERVAL_WHEN_NOT_FOCUSED = 10 * SEC;
const BACKEND_INTERVAL = 30 * SEC;
const LONG_BACKEND_INTERVAL = 60 * SEC;
const NFT_FULL_INTERVAL = 60 * SEC;
const SWAP_POLLING_INTERVAL = 3 * SEC;
const SWAP_POLLING_INTERVAL_WHEN_NOT_FOCUSED = 10 * SEC;
const SWAP_FINISHED_STATUSES = new Set(['failed', 'completed', 'expired']);
const VERSIONS_INTERVAL = 5 * 60 * SEC;
const VERSIONS_INTERVAL_WHEN_NOT_FOCUSED = 15 * 60 * SEC;

const FIRST_TRANSACTIONS_LIMIT = 50;
const DOUBLE_CHECK_TOKENS_PAUSE = 30 * SEC;

let onUpdate: OnApiUpdate;
let isAccountActive: IsAccountActiveFn;

const prices: {
  baseCurrency: ApiBaseCurrency;
  bySlug: Record<string, ApiTokenPrice>;
} = {
  baseCurrency: DEFAULT_PRICE_CURRENCY,
  bySlug: {},
};
let swapPollingAccountId: string | undefined;
const lastBalanceCache: Record<string, {
  balance?: bigint;
  tokenBalances?: ApiBalanceBySlug;
}> = {};

export async function initPolling(_onUpdate: OnApiUpdate, _isAccountActive: IsAccountActiveFn) {
  onUpdate = _onUpdate;
  isAccountActive = _isAccountActive;

  await tryUpdatePrices();

  Promise.all([
    tryUpdateKnownAddresses(),
    tryUpdateTokens(_onUpdate),
    tryLoadSwapTokens(_onUpdate),
    tryUpdateStakingCommonData(),
  ]).then(() => resolveDataPreloadPromise());

  void tryUpdateConfig(_onUpdate);

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
        priceUsd: 0.0,
        percentChange24h: 0.0,
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
  let lastNftFullUpdate = 0;
  let doubleCheckTokensTime: number | undefined;
  let tokenBalances: TokenBalanceParsed[] | undefined;

  const localOnUpdate = onUpdate;

  while (isAlive(localOnUpdate, accountId)) {
    try {
      const walletInfo = await blockchain.getWalletInfo(network, address);
      if (!isAlive(localOnUpdate, accountId)) return;

      const { balance, lastTxId } = walletInfo ?? {};

      if (Date.now() - lastNftFullUpdate > NFT_FULL_INTERVAL) {
        const nfts = await blockchain.getAccountNfts(accountId).catch(logAndRescue);

        lastNftFullUpdate = Date.now();

        if (!isAlive(localOnUpdate, accountId)) return;

        if (nfts) {
          nftFromSec = Math.round(Date.now() / 1000);
          if (!isAlive(localOnUpdate, accountId)) return;

          void updateNfts(accountId, nfts);
        }
      }

      // Process TON balance
      const cache = lastBalanceCache[accountId];
      const changedTokenSlugs: string[] = [];
      const isTonBalanceChanged = balance !== undefined && balance !== cache?.balance;

      const balancesToUpdate: ApiBalanceBySlug = {};

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

        if (!isAlive(localOnUpdate, accountId)) return;

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
        if (!isAlive(localOnUpdate, accountId)) return;

        if (nftResult) {
          [nftFromSec, nftUpdates] = nftResult;
          void processNftUpdates(accountId, nftUpdates);
        }
      }

      if (isTonBalanceChanged && !isInitialized && await blockchain.isAddressInitialized(network, address)) {
        isInitialized = true;
        await updateStoredAccount(accountId, { isInitialized });
      }
    } catch (err) {
      logDebugError('setupBalanceBasedPolling', err);
    }

    await pauseOrFocus(BALANCE_BASED_INTERVAL, BALANCE_BASED_INTERVAL_WHEN_NOT_FOCUSED);
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

  while (isAlive(localOnUpdate, accountId)) {
    try {
      const stakingCommonData = getStakingCommonCache();
      const backendStakingState = await getBackendStakingState(accountId);
      const stakingState = await blockchain.getStakingState(accountId, backendStakingState);

      if (!isAlive(localOnUpdate, accountId)) return;

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
      logDebugError('setupStakingPolling', err);
    }

    await pauseOrFocus(STAKING_INTERVAL, STAKING_INTERVAL_WHEN_NOT_FOCUSED);
  }
}

async function processNewActivities(
  accountId: string,
  newestTxIds: ApiTxIdBySlug,
  tokenSlugs: string[],
  tokenBalances?: TokenBalanceParsed[],
): Promise<ApiTxIdBySlug> {
  const { network, blockchain } = parseAccountId(accountId);
  const activeBlockchain = blockchains[blockchain];

  const chunks: ApiTransactionActivity[][] = [];
  const result: [string, string | undefined][] = [];

  // Process TON transactions first
  {
    const slug = TON_TOKEN_SLUG;
    let newestTxId = newestTxIds[slug];

    const transactions = await activeBlockchain.getTokenTransactionSlice(
      accountId, slug, undefined, newestTxId, FIRST_TRANSACTIONS_LIMIT,
    );

    if (transactions.length) {
      newestTxId = transactions[0]!.txId;
      chunks.push(transactions);
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

  // Process token transactions
  await Promise.all(tokenSlugs.map(async (slug) => {
    let newestTxId = newestTxIds[slug];

    const transactions = await activeBlockchain.getTokenTransactionSlice(
      accountId, slug, undefined, newestTxId, FIRST_TRANSACTIONS_LIMIT,
    );

    if (transactions.length) {
      newestTxId = transactions[0]!.txId;
      chunks.push(transactions);
    }

    result.push([slug, newestTxId]);
  }));

  const allTransactions = chunks.flat().sort((a, b) => compareActivities(a, b));
  const isFirstRun = !Object.keys(newestTxIds).length;
  const activities = await swapReplaceTransactionsByRanges(accountId, allTransactions, chunks, isFirstRun);

  allTransactions.sort((a, b) => compareActivities(a, b, true));
  allTransactions.forEach((transaction) => {
    txCallbacks.runCallbacks(transaction);
  });

  await activeBlockchain.fixTokenActivitiesAddressForm(network, activities);

  onUpdate({
    type: 'newActivities',
    activities,
    accountId,
  });

  return Object.fromEntries(result);
}

export async function setupBackendPolling() {
  const localOnUpdate = onUpdate;

  while (isUpdaterAlive(localOnUpdate)) {
    await pauseOrFocus(BACKEND_INTERVAL);
    if (!isUpdaterAlive(localOnUpdate)) return;

    try {
      await tryUpdatePrices(localOnUpdate);
      await tryUpdateTokens(localOnUpdate);
    } catch (err) {
      logDebugError('setupBackendPolling', err);
    }
  }
}

export async function setupLongBackendPolling() {
  const localOnUpdate = onUpdate;

  while (isUpdaterAlive(localOnUpdate)) {
    await pauseOrFocus(LONG_BACKEND_INTERVAL);

    await Promise.all([
      tryUpdateKnownAddresses(),
      tryUpdateStakingCommonData(),
      tryUpdateConfig(localOnUpdate),
    ]);
  }
}

export async function tryUpdatePrices(localOnUpdate?: OnApiUpdate) {
  if (!localOnUpdate) {
    localOnUpdate = onUpdate;
  }

  try {
    const baseCurrency = await getBaseCurrency();
    const pricesData = await callBackendGet<Record<string, ApiTokenPrice>>('/prices/current', {
      base: baseCurrency,
    });

    if (!isUpdaterAlive(localOnUpdate)) return;

    prices.bySlug = buildCollectionByKey(Object.values(pricesData), 'slug');
    prices.baseCurrency = baseCurrency;
  } catch (err) {
    logDebugError('tryUpdatePrices', err);
  }
}

export async function tryUpdateTokens(localOnUpdate?: OnApiUpdate) {
  if (!localOnUpdate) {
    localOnUpdate = onUpdate;
  }

  try {
    const tokens = await callBackendGet<ApiBaseToken[]>('/known-tokens');

    if (!isUpdaterAlive(localOnUpdate)) return;

    addKnownTokens(tokens);

    sendUpdateTokens();
  } catch (err) {
    logDebugError('tryUpdateTokens', err);
  }
}

export async function tryLoadSwapTokens(localOnUpdate?: OnApiUpdate) {
  if (!localOnUpdate) {
    localOnUpdate = onUpdate;
  }

  try {
    const assets = await swapGetAssets();

    if (!isUpdaterAlive(localOnUpdate)) return;

    const tokens = assets.reduce((acc: Record<string, ApiSwapAsset>, asset) => {
      acc[asset.slug] = {
        ...asset,
        contract: asset.contract ?? asset.slug,
        price: prices.bySlug[asset.slug]?.price ?? 0,
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

export async function tryUpdateConfig(localOnUpdate: OnApiUpdate) {
  try {
    const { isLimited, isCopyStorageEnabled = false } = await callBackendGet<{
      isLimited: boolean;
      isCopyStorageEnabled?: boolean;
    }>('/utils/get-config');

    if (!isUpdaterAlive(localOnUpdate)) return;

    onUpdate({
      type: 'updateConfig',
      isLimited,
      isCopyStorageEnabled,
    });
  } catch (err) {
    logDebugError('tryUpdateRegion', err);
  }
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

  while (isAlive(localOnUpdate, accountId)) {
    try {
      const swaps = await swapGetHistory(address, {
        fromTimestamp,
      });
      if (!isAlive(localOnUpdate, accountId)) break;
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
      logDebugError('setupSwapPolling', err);
    }

    await pauseOrFocus(SWAP_POLLING_INTERVAL, SWAP_POLLING_INTERVAL_WHEN_NOT_FOCUSED);
  }

  if (accountId === swapPollingAccountId) {
    swapPollingAccountId = undefined;
  }
}

function isAlive(localOnUpdate: OnApiUpdate, accountId: string) {
  return isUpdaterAlive(localOnUpdate) && isAccountActive(accountId);
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

export async function setupWalletVersionsPolling(accountId: string) {
  const { ton } = blockchains;

  const localOnUpdate = onUpdate;

  const { publicKey, version } = await fetchStoredAccount(accountId);
  const publicKeyBytes = hexToBytes(publicKey);
  const { network } = parseAccountId(accountId);

  const versions = POPULAR_WALLET_VERSIONS.filter((value) => value !== version);
  let lastResult: ApiWalletInfo[] | undefined;

  while (isAlive(localOnUpdate, accountId)) {
    try {
      const versionInfos = (await ton.getWalletVersionInfos(
        network, publicKeyBytes, versions,
      )).filter(({ lastTxId }) => !!lastTxId);

      const filteredVersions = versionInfos.map(({ wallet, ...rest }) => rest);

      if (!isAlive(localOnUpdate, accountId)) return;

      if (!areDeepEqual(versionInfos, lastResult)) {
        lastResult = versionInfos;
        onUpdate({
          type: 'updateWalletVersions',
          accountId,
          currentVersion: version,
          versions: filteredVersions,
        });
      }
    } catch (err) {
      logDebugError('setupWalletVersionsPolling', err);
    }

    await pauseOrFocus(VERSIONS_INTERVAL, VERSIONS_INTERVAL_WHEN_NOT_FOCUSED);
  }
}

import type { TokenBalanceParsed } from '../blockchains/ton/tokens';
import type {
  ApiBackendStakingState,
  ApiBalanceBySlug,
  ApiBaseCurrency,
  ApiBaseToken,
  ApiCountryCode,
  ApiNftUpdate,
  ApiStakingCommonData,
  ApiStakingState,
  ApiSwapAsset,
  ApiTokenPrice,
  ApiTransactionActivity,
  ApiTxIdBySlug,
  ApiVestingInfo,
  ApiWalletInfo,
  OnApiUpdate,
} from '../types';

import { DEFAULT_PRICE_CURRENCY, POPULAR_WALLET_VERSIONS, TONCOIN_SLUG } from '../../config';
import { parseAccountId } from '../../util/account';
import { areDeepEqual } from '../../util/areDeepEqual';
import { compareActivities } from '../../util/compareActivities';
import { buildCollectionByKey, omit } from '../../util/iteratees';
import { logDebugError } from '../../util/logs';
import { pauseOrFocus } from '../../util/pauseOrFocus';
import blockchains from '../blockchains';
import { addKnownToken, addKnownTokens, getKnownTokens } from '../blockchains/ton/tokens';
import { fetchStoredAccount, updateStoredAccount } from '../common/accounts';
import { tryUpdateKnownAddresses } from '../common/addresses';
import { callBackendGet } from '../common/backend';
import { getStakingCommonCache } from '../common/cache';
import { isUpdaterAlive, resolveBlockchainKey } from '../common/helpers';
import { txCallbacks } from '../common/txCallbacks';
import { hexToBytes } from '../common/utils';
import { AbortOperationError } from '../errors';
import { processNftUpdates, updateAccountNfts } from './nfts';
import { resolveDataPreloadPromise } from './preload';
import { getBaseCurrency } from './prices';
import { getBackendStakingState, tryUpdateStakingCommonData } from './staking';
import { swapGetAssets, swapReplaceTransactionsByRanges } from './swap';
import { fetchVestings } from './vesting';

type IsAccountActiveFn = (accountId: string) => boolean;

type AccountBalanceCache = {
  balance?: bigint;
  tokenBalances?: ApiBalanceBySlug;
};

const SEC = 1000;
const BALANCE_BASED_INTERVAL = 1.1 * SEC;
const BALANCE_BASED_INTERVAL_WHEN_NOT_FOCUSED = 10 * SEC;
const STAKING_INTERVAL = 5 * SEC;
const STAKING_INTERVAL_WHEN_NOT_FOCUSED = 10 * SEC;
const BACKEND_INTERVAL = 30 * SEC;
const LONG_BACKEND_INTERVAL = 60 * SEC;
const NFT_FULL_INTERVAL = 60 * SEC;
const VERSIONS_INTERVAL = 5 * 60 * SEC;
const VERSIONS_INTERVAL_WHEN_NOT_FOCUSED = 15 * 60 * SEC;
const VESTING_INTERVAL = 10 * SEC;
const VESTING_INTERVAL_WHEN_NOT_FOCUSED = 60 * SEC;
const INCORRECT_TIME_DIFF = 30 * SEC;

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

const lastBalanceCache: Record<string, AccountBalanceCache> = {};

export async function initPolling(_onUpdate: OnApiUpdate, _isAccountActive: IsAccountActiveFn) {
  onUpdate = _onUpdate;
  isAccountActive = _isAccountActive;

  await tryUpdatePrices();

  Promise.allSettled([
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
    addKnownToken({
      ...token,
      quote: prices.bySlug[token.slug] || {
        slug: token.slug,
        price: 0.0,
        priceUsd: 0.0,
        percentChange24h: 0.0,
      },
    });
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

  async function updateBalance(cache: AccountBalanceCache) {
    const walletInfo = await blockchain.getWalletInfo(network, address);
    const { balance, lastTxId } = walletInfo ?? {};
    const isToncoinBalanceChanged = balance !== undefined && balance !== cache?.balance;
    const balancesToUpdate: ApiBalanceBySlug = {};

    if (isToncoinBalanceChanged) {
      balancesToUpdate[TONCOIN_SLUG] = balance;

      lastBalanceCache[accountId] = {
        ...lastBalanceCache[accountId],
        balance,
      };
    }

    return {
      lastTxId, isToncoinBalanceChanged, balancesToUpdate,
    };
  }

  async function updateNfts(isToncoinBalanceChanged: boolean) {
    if (Date.now() - lastNftFullUpdate < NFT_FULL_INTERVAL) {
      // Partial update
      if (isToncoinBalanceChanged) {
        const nftResult = await blockchain.getNftUpdates(accountId, nftFromSec).catch(logAndRescue);

        throwErrorIfUpdaterNotAlive(localOnUpdate, accountId);

        if (nftResult) {
          [nftFromSec, nftUpdates] = nftResult;
          void processNftUpdates(accountId, nftUpdates);
        }
      }
    } else {
      // Full update
      const nfts = await blockchain.getAccountNfts(accountId).catch(logAndRescue);
      lastNftFullUpdate = Date.now();

      throwErrorIfUpdaterNotAlive(localOnUpdate, accountId);

      if (nfts) {
        nftFromSec = Math.round(Date.now() / 1000);
        void updateAccountNfts(accountId, nfts);
      }
    }
  }

  async function updateTokenBalances(
    isToncoinBalanceChanged: boolean,
    cache: AccountBalanceCache,
    balancesToUpdate: ApiBalanceBySlug,
  ) {
    const changedTokenSlugs: string[] = [];

    if (isToncoinBalanceChanged || (doubleCheckTokensTime && doubleCheckTokensTime < Date.now())) {
      doubleCheckTokensTime = isToncoinBalanceChanged ? Date.now() + DOUBLE_CHECK_TOKENS_PAUSE : undefined;
      tokenBalances = await blockchain.getAccountTokenBalances(accountId).catch(logAndRescue);

      throwErrorIfUpdaterNotAlive(localOnUpdate, accountId);

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

    onUpdate({ type: 'updatingStatus', kind: 'balance', isUpdating: false });

    return changedTokenSlugs;
  }

  async function updateActivities(isToncoinBalanceChanged: boolean, changedTokenSlugs: string[], lastTxId?: string) {
    if (isToncoinBalanceChanged || changedTokenSlugs.length) {
      if (lastTxId) {
        await blockchain.waitUntilTransactionAppears(network, address, lastTxId);
      }

      const newTxIds = await processNewActivities(accountId, newestTxIds, changedTokenSlugs, tokenBalances);
      newestTxIds = { ...newestTxIds, ...newTxIds };
    }

    onUpdate({ type: 'updatingStatus', kind: 'activities', isUpdating: false });
  }

  while (isAlive(localOnUpdate, accountId)) {
    try {
      onUpdate({ type: 'updatingStatus', kind: 'activities', isUpdating: true });
      onUpdate({ type: 'updatingStatus', kind: 'balance', isUpdating: true });

      const cache = lastBalanceCache[accountId];

      const {
        lastTxId,
        isToncoinBalanceChanged,
        balancesToUpdate,
      } = await updateBalance(cache);

      throwErrorIfUpdaterNotAlive(localOnUpdate, accountId);

      const changedTokenSlugs = await updateTokenBalances(isToncoinBalanceChanged, cache, balancesToUpdate);

      await Promise.all([
        updateActivities(isToncoinBalanceChanged, changedTokenSlugs, lastTxId),
        updateNfts(isToncoinBalanceChanged),
      ]);

      if (isToncoinBalanceChanged && !isInitialized && await blockchain.isAddressInitialized(network, address)) {
        isInitialized = true;
        await updateStoredAccount(accountId, { isInitialized });
      }
    } catch (err) {
      if (err instanceof AbortOperationError) {
        return;
      }
      logDebugError('setupBalanceBasedPolling', err);
    }

    await pauseOrFocus(BALANCE_BASED_INTERVAL, BALANCE_BASED_INTERVAL_WHEN_NOT_FOCUSED);
  }
}

function throwErrorIfUpdaterNotAlive(localOnUpdate: OnApiUpdate, accountId: string) {
  if (!isAlive(localOnUpdate, accountId)) {
    throw new AbortOperationError();
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
    const slug = TONCOIN_SLUG;
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

  const allTransactions = chunks.flat().sort(compareActivities);

  const isFirstRun = !Object.keys(newestTxIds).length;
  const activities = await swapReplaceTransactionsByRanges(accountId, allTransactions, chunks, isFirstRun);

  allTransactions.slice().reverse().forEach((transaction) => {
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
    const {
      isLimited,
      isCopyStorageEnabled = false,
      supportAccountsCount = 1,
      now: serverUtc,
      country: countryCode,
    } = await callBackendGet<{
      isLimited: boolean;
      isCopyStorageEnabled?: boolean;
      supportAccountsCount?: number;
      now: number;
      country: ApiCountryCode;
    }>('/utils/get-config');

    if (!isUpdaterAlive(localOnUpdate)) return;

    onUpdate({
      type: 'updateConfig',
      isLimited,
      isCopyStorageEnabled,
      supportAccountsCount,
      countryCode,
    });

    const localUtc = (new Date()).getTime();
    if (Math.abs(serverUtc - localUtc) > INCORRECT_TIME_DIFF) {
      onUpdate({
        type: 'incorrectTime',
      });
    }
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

function isAlive(localOnUpdate: OnApiUpdate, accountId: string) {
  return isUpdaterAlive(localOnUpdate) && isAccountActive(accountId);
}

function logAndRescue(err: Error) {
  logDebugError('Polling error', err);

  return undefined;
}

export async function setupWalletVersionsPolling(accountId: string) {
  const { ton } = blockchains;

  const localOnUpdate = onUpdate;

  const {
    address, publicKey, version, isInitialized,
  } = await fetchStoredAccount(accountId);
  const publicKeyBytes = hexToBytes(publicKey);
  const { network } = parseAccountId(accountId);

  const versions = POPULAR_WALLET_VERSIONS.filter((value) => value !== version);
  let lastResult: ApiWalletInfo[] | undefined;

  let shouldCheckV4 = false;
  let v4HasTokens: boolean | undefined;

  if (version === 'W5' && !isInitialized) {
    const { lastTxId } = await ton.getWalletInfo(network, address);
    shouldCheckV4 = !lastTxId;
  }

  while (isAlive(localOnUpdate, accountId)) {
    try {
      const allWalletInfos = (await ton.getWalletVersionInfos(network, publicKeyBytes, versions))
        .map((versionInfo) => omit(versionInfo, ['wallet']));
      const filteredInfos: ApiWalletInfo[] = [];

      for (const walletInfo of allWalletInfos) {
        if (!!walletInfo.lastTxId || walletInfo.version === 'W5') {
          filteredInfos.push(walletInfo);
        } else if (walletInfo.version === 'v4R2' && !walletInfo.lastTxId && shouldCheckV4) {
          if (v4HasTokens === undefined) {
            v4HasTokens = !!(await ton.getTokenBalances(network, walletInfo.address)).length;
          }

          if (v4HasTokens) {
            filteredInfos.push(walletInfo);
          }
        }
      }

      if (!isAlive(localOnUpdate, accountId)) return;

      if (!areDeepEqual(allWalletInfos, lastResult)) {
        lastResult = allWalletInfos;
        onUpdate({
          type: 'updateWalletVersions',
          accountId,
          currentVersion: version,
          versions: filteredInfos,
        });
      }
    } catch (err) {
      logDebugError('setupWalletVersionsPolling', err);
    }

    await pauseOrFocus(VERSIONS_INTERVAL, VERSIONS_INTERVAL_WHEN_NOT_FOCUSED);
  }
}

export async function setupVestingPolling(accountId: string) {
  const localOnUpdate = onUpdate;
  let lastVestingInfo: ApiVestingInfo[] | undefined;

  while (isAlive(localOnUpdate, accountId)) {
    try {
      const vestingInfo = await fetchVestings(accountId);

      if (!isAlive(localOnUpdate, accountId)) return;
      if (!areDeepEqual(lastVestingInfo, vestingInfo)) {
        lastVestingInfo = vestingInfo;
        onUpdate({
          type: 'updateVesting',
          accountId,
          vestingInfo,
        });
      }
    } catch (err) {
      logDebugError('setupVestingPolling', err);
    }

    await pauseOrFocus(VESTING_INTERVAL, VESTING_INTERVAL_WHEN_NOT_FOCUSED);
  }
}

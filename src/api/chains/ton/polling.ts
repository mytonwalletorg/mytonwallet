import type {
  ApiActivity,
  ApiActivityTimestamps,
  ApiBalanceBySlug,
  ApiNetwork,
  ApiNftUpdate,
  ApiStakingState,
  ApiTokenWithPrice,
  ApiTonWallet,
  ApiUpdatingStatus,
  ApiVestingInfo,
  ApiWalletInfo,
  OnApiUpdate,
} from '../../types';
import type { TokenBalanceParsed } from './tokens';

import {
  IS_CORE_WALLET,
  LEDGER_WALLET_VERSIONS,
  POPULAR_WALLET_VERSIONS,
  SWAP_CROSSCHAIN_SLUGS,
  TONCOIN,
} from '../../../config';
import { parseAccountId } from '../../../util/account';
import { getActivityTokenSlugs } from '../../../util/activities';
import { areDeepEqual } from '../../../util/areDeepEqual';
import { compact, pick } from '../../../util/iteratees';
import { logDebugError } from '../../../util/logs';
import { pauseOrFocus } from '../../../util/pauseOrFocus';
import {
  fetchStoredAccount,
  fetchStoredAccounts,
  fetchStoredTonWallet,
  getActiveAccountId,
  updateStoredTonWallet,
} from '../../common/accounts';
import { getStakingCommonCache } from '../../common/cache';
import { isAlive, isUpdaterAlive } from '../../common/helpers';
import { processNftUpdates, updateAccountNfts } from '../../common/nft';
import { swapReplaceCexActivities } from '../../common/swap';
import { updateTokens } from '../../common/tokens';
import { txCallbacks } from '../../common/txCallbacks';
import { hexToBytes } from '../../common/utils';
import { FIRST_TRANSACTIONS_LIMIT, SEC } from '../../constants';
import { AbortOperationError } from '../../errors';
import { fetchActivitySlice } from './activities';
import { getWalletFromAddress } from './auth';
import { getAccountNfts, getNftUpdates } from './nfts';
import { updateTokenHashes } from './priceless';
import { getBackendStakingState, getStakingStates } from './staking';
import { getAccountTokenBalances } from './tokens';
import { fetchVestings } from './vesting';
import { getWalletInfo, getWalletVersionInfos, isAddressInitialized } from './wallet';

type OnUpdatingStatusChange = (kind: ApiUpdatingStatus['kind'], isUpdating: boolean) => void;

const BALANCE_BASED_INTERVAL = 1.1 * SEC;
const BALANCE_BASED_INTERVAL_WHEN_NOT_FOCUSED = 10 * SEC;
const DOUBLE_CHECK_TOKENS_PAUSE = 30 * SEC;
const DOUBLE_CHECK_ACTIVITIES_PAUSE = 10 * SEC; // TODO (actions) Can it be reduced?
const FORCE_CHECK_ACTIVITIES_PAUSE = 30 * SEC;
const NFT_FULL_INTERVAL = 60 * SEC;

const STAKING_INTERVAL = 5 * SEC;
const STAKING_INTERVAL_WHEN_NOT_FOCUSED = 10 * SEC;

const VERSIONS_INTERVAL = 5 * 60 * SEC;
const VERSIONS_INTERVAL_WHEN_NOT_FOCUSED = 15 * 60 * SEC;
const VESTING_INTERVAL = 10 * SEC;
const VESTING_INTERVAL_WHEN_NOT_FOCUSED = 60 * SEC;

const BALANCE_NOT_ACTIVE_ACCOUNTS_INTERVAL = 30 * SEC;
const BALANCE_NOT_ACTIVE_ACCOUNTS_INTERVAL_WHEN_NOT_FOCUSED = 60 * SEC;

const lastBalanceCache: Record<string, ApiBalanceBySlug> = {};

export function setupPolling(
  accountId: string,
  onUpdate: OnApiUpdate,
  onUpdatingStatusChange: OnUpdatingStatusChange,
  newestActivityTimestamps: ApiActivityTimestamps,
) {
  const newestTimestamps = compact(Object.values(newestActivityTimestamps));
  const newestActivityTimestamp = newestTimestamps.length ? Math.max(...newestTimestamps) : undefined;

  void setupBalanceBasedPolling(accountId, onUpdate, onUpdatingStatusChange, newestActivityTimestamp);
  void setupWalletVersionsPolling(accountId, onUpdate);

  if (!IS_CORE_WALLET) {
    void setupStakingPolling(accountId, onUpdate);
    void setupVestingPolling(accountId, onUpdate);
  }
}

async function setupBalanceBasedPolling(
  accountId: string,
  onUpdate: OnApiUpdate,
  onUpdatingStatusChange: OnUpdatingStatusChange,
  newestActivityTimestamp?: number,
) {
  delete lastBalanceCache[accountId];

  const { network } = parseAccountId(accountId);
  let wallet = await fetchStoredTonWallet(accountId);

  let nftFromSec = Math.round(Date.now() / 1000);
  let nftUpdates: ApiNftUpdate[];
  let lastNftFullUpdate = 0;
  let doubleCheckTokensTime: number | undefined;
  let forceCheckActivitiesTime = 0;

  async function updateBalance(cache: ApiBalanceBySlug, newBalances: ApiBalanceBySlug, changedSlugs: string[]) {
    const { balance, lastTxId } = await getWalletInfo(network, wallet.address);
    const isToncoinBalanceChanged = balance !== undefined && balance !== cache[TONCOIN.slug];

    newBalances[TONCOIN.slug] = balance;
    if (isToncoinBalanceChanged) {
      changedSlugs.push(TONCOIN.slug);
    }

    return { lastTxId, isToncoinBalanceChanged };
  }

  async function updateNfts(isToncoinBalanceChanged: boolean) {
    if (Date.now() - lastNftFullUpdate < NFT_FULL_INTERVAL) {
      // Partial update
      if (isToncoinBalanceChanged) {
        const nftResult = await getNftUpdates(accountId, nftFromSec).catch(logAndRescue);

        throwErrorIfUpdaterNotAlive(onUpdate, accountId);

        if (nftResult) {
          [nftFromSec, nftUpdates] = nftResult;
          void processNftUpdates(accountId, nftUpdates, onUpdate);
        }
      }
    } else {
      // Full update
      const nfts = await getAccountNfts(accountId).catch(logAndRescue);
      lastNftFullUpdate = Date.now();

      throwErrorIfUpdaterNotAlive(onUpdate, accountId);

      if (nfts) {
        nftFromSec = Math.round(Date.now() / 1000);
        void updateAccountNfts(accountId, nfts, onUpdate);
      }
    }
  }

  async function updateTokenBalances(
    isToncoinBalanceChanged: boolean,
    cache: ApiBalanceBySlug,
    newBalances: ApiBalanceBySlug,
    changedSlugs: string[],
  ) {
    let tokenBalances: TokenBalanceParsed[] = [];

    if (isToncoinBalanceChanged || (doubleCheckTokensTime && doubleCheckTokensTime < Date.now())) {
      doubleCheckTokensTime = isToncoinBalanceChanged ? Date.now() + DOUBLE_CHECK_TOKENS_PAUSE : undefined;
      tokenBalances = await getAccountTokenBalances(accountId);

      throwErrorIfUpdaterNotAlive(onUpdate, accountId);

      const tokens: ApiTokenWithPrice[] = tokenBalances.filter(Boolean).map(({ token }) => ({
        ...token,
        price: 0,
        priceUsd: 0,
        percentChange24h: 0,
      }));

      await updateTokens(tokens, onUpdate);
      await updateTokenHashes(network, tokens, onUpdate);

      tokenBalances.forEach(({ slug, balance: tokenBalance }) => {
        newBalances[slug] = tokenBalance;
        if (cache[slug] !== tokenBalance) {
          changedSlugs.push(slug);
        }
      });
    }

    return tokenBalances;
  }

  async function updateActivities(isToncoinBalanceChanged: boolean, balances: ApiBalanceBySlug) {
    if (!isToncoinBalanceChanged && forceCheckActivitiesTime > Date.now()) {
      return;
    }

    forceCheckActivitiesTime = Date.now() + (isToncoinBalanceChanged
      // The activity update may be delayed after the TON balance changes, so we wait a few seconds before the 2nd attempt.
      ? DOUBLE_CHECK_ACTIVITIES_PAUSE
      // We suspect that the 2nd attempt after a short delay doesn't always bring the new activities,
      // so we poll the activities even if the TON balance hasn't changed just in case.
      : FORCE_CHECK_ACTIVITIES_PAUSE
    );

    if (newestActivityTimestamp) {
      newestActivityTimestamp = await loadNewActivities(accountId, newestActivityTimestamp, onUpdate);
    } else {
      newestActivityTimestamp = await loadInitialActivities(accountId, Object.keys(balances), onUpdate);
    }
  }

  while (isAlive(onUpdate, accountId)) {
    try {
      onUpdatingStatusChange('balance', true);
      onUpdatingStatusChange('activities', true);

      const newBalances: ApiBalanceBySlug = {};
      const changedSlugs: string[] = [];
      const cache = lastBalanceCache[accountId] ?? {};

      const { isToncoinBalanceChanged } = await updateBalance(cache, newBalances, changedSlugs);

      throwErrorIfUpdaterNotAlive(onUpdate, accountId);

      await updateTokenBalances(isToncoinBalanceChanged, cache, newBalances, changedSlugs);

      lastBalanceCache[accountId] = newBalances;

      if (changedSlugs.length) {
        onUpdate({
          type: 'updateBalances',
          accountId,
          chain: 'ton',
          balances: newBalances,
        });
      }

      onUpdatingStatusChange('balance', false);

      await Promise.all([
        updateActivities(isToncoinBalanceChanged, newBalances),
        updateNfts(isToncoinBalanceChanged),
      ]);

      onUpdatingStatusChange('activities', false);

      if (isToncoinBalanceChanged) {
        wallet = await checkWalletInitialization(accountId, wallet);
      }
    } catch (err) {
      if (err instanceof AbortOperationError) {
        return;
      }
      logDebugError('setupBalanceBasedPolling', err);
    } finally {
      onUpdatingStatusChange('balance', false);
      onUpdatingStatusChange('activities', false);
    }

    await pauseOrFocus(BALANCE_BASED_INTERVAL, BALANCE_BASED_INTERVAL_WHEN_NOT_FOCUSED);
  }
}

function throwErrorIfUpdaterNotAlive(onUpdate: OnApiUpdate, accountId: string) {
  if (!isAlive(onUpdate, accountId)) {
    throw new AbortOperationError();
  }
}

async function setupStakingPolling(accountId: string, onUpdate: OnApiUpdate) {
  const { network } = parseAccountId(accountId);

  if (network !== 'mainnet') {
    return;
  }

  let lastStates: ApiStakingState[] | undefined;

  while (isAlive(onUpdate, accountId)) {
    try {
      const common = getStakingCommonCache();
      const backendState = await getBackendStakingState(accountId);
      const { shouldUseNominators, totalProfit } = backendState;
      const states = await getStakingStates(accountId, common, backendState);

      if (!isAlive(onUpdate, accountId)) return;

      if (!areDeepEqual(states, lastStates)) {
        lastStates = states;
        onUpdate({
          type: 'updateStaking',
          accountId,
          states,
          common,
          totalProfit,
          shouldUseNominators,
        });
      }
    } catch (err) {
      logDebugError('setupStakingPolling', err);
    }

    await pauseOrFocus(STAKING_INTERVAL, STAKING_INTERVAL_WHEN_NOT_FOCUSED);
  }
}

async function loadNewActivities(accountId: string, newestActivityTimestamp: number, onUpdate: OnApiUpdate) {
  let activities = await fetchActivitySlice(
    accountId, undefined, undefined, newestActivityTimestamp, FIRST_TRANSACTIONS_LIMIT,
  );

  if (activities.length) {
    newestActivityTimestamp = activities[0].timestamp;
  }

  activities = await swapReplaceCexActivities(accountId, activities, undefined, true);

  activities.slice().reverse().forEach((transaction) => {
    txCallbacks.runCallbacks(transaction);
  });

  onUpdate({
    type: 'newActivities',
    chain: 'ton',
    activities,
    accountId,
  });

  return newestActivityTimestamp;
}

async function loadInitialActivities(accountId: string, tokenSlugs: string[], onUpdate: OnApiUpdate) {
  const bySlug: Record<string, ApiActivity[]> = {};
  let mainActivities: ApiActivity[] = [];

  let newestActivityTimestamp: number | undefined;

  await Promise.all(tokenSlugs.map(async (slug) => {
    const tokenSlug = slug !== TONCOIN.slug ? slug : undefined;
    let activities = await fetchActivitySlice(accountId, tokenSlug, undefined, FIRST_TRANSACTIONS_LIMIT);

    if (SWAP_CROSSCHAIN_SLUGS.has(slug)) {
      activities = await swapReplaceCexActivities(accountId, activities, slug, true);
    }

    if (slug === TONCOIN.slug && activities.length) {
      // Activities for each Jetton wallet are loaded only the first time.
      // New token activities will be loaded along with TON.
      newestActivityTimestamp = activities[0].timestamp;

      // There is no way to load TON activities without loading activities of other tokens
      mainActivities = activities;
      activities = activities.filter((activity) => getActivityTokenSlugs(activity).includes(TONCOIN.slug));
    }

    bySlug[slug] = activities;
  }));

  onUpdate({
    type: 'initialActivities',
    chain: 'ton',
    accountId,
    mainActivities,
    bySlug,
  });

  return newestActivityTimestamp;
}

function logAndRescue(err: Error) {
  logDebugError('Polling error', err);

  return undefined;
}

async function setupWalletVersionsPolling(accountId: string, onUpdate: OnApiUpdate) {
  const { type: accountType } = await fetchStoredAccount(accountId);
  if (accountType === 'bip39') {
    return;
  }

  const isLedger = accountType === 'ledger';
  const { network } = parseAccountId(accountId);

  let lastResult: ApiWalletInfo[] | undefined;

  while (isAlive(onUpdate, accountId)) {
    try {
      const { publicKey, version, isInitialized } = await fetchStoredTonWallet(accountId);
      if (!publicKey) {
        if (!isInitialized) {
          // Keep polling because `publicKey` may arrive later (for example, when the view wallet becomes initialized)
          await pauseOrFocus(VERSIONS_INTERVAL, VERSIONS_INTERVAL_WHEN_NOT_FOCUSED);
          continue;
        }

        // This happens when this address is not a wallet address (for example, a contract address)
        onUpdate({
          type: 'updateWalletVersions',
          accountId,
          currentVersion: version,
          versions: [],
        });
        break;
      }

      const publicKeyBytes = hexToBytes(publicKey);
      const versions = (isLedger ? LEDGER_WALLET_VERSIONS : POPULAR_WALLET_VERSIONS)
        .filter((value) => value !== version);
      const versionInfos = (await getWalletVersionInfos(
        network, publicKeyBytes, versions,
      )).filter((versionInfo) => !!versionInfo.lastTxId || versionInfo.version === 'W5');

      const filteredVersions = versionInfos.map(({ wallet, ...rest }) => rest);

      if (!isAlive(onUpdate, accountId)) return;

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

async function setupVestingPolling(accountId: string, onUpdate: OnApiUpdate) {
  let lastVestingInfo: ApiVestingInfo[] | undefined;

  while (isAlive(onUpdate, accountId)) {
    try {
      const vestingInfo = await fetchVestings(accountId);

      if (!isAlive(onUpdate, accountId)) return;
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

export async function setupInactiveAccountsBalancePolling(onUpdate: OnApiUpdate) {
  interface BalancePollingAccount {
    id: string;
    network: ApiNetwork;
    address: string;
  }
  let addressToAccountsMap: { [address: string]: BalancePollingAccount[] } = {};
  let activeAccountId: string | undefined;

  const localOnUpdate = onUpdate;

  async function updateAddressToAccountsMap() {
    const accountsById = await fetchStoredAccounts();
    addressToAccountsMap = {};

    for (const [accountId, account] of Object.entries(accountsById)) {
      if (accountId === activeAccountId || !account.ton) {
        continue;
      }

      const { network } = parseAccountId(accountId);
      const { address } = account.ton;

      const balancePollingAccount: BalancePollingAccount = {
        id: accountId,
        network,
        address,
      };

      if (!addressToAccountsMap[address]) {
        addressToAccountsMap[address] = [];
      }
      addressToAccountsMap[address].push(balancePollingAccount);
    }
  }

  async function updateBalance(
    account: BalancePollingAccount,
    cache: ApiBalanceBySlug,
    newBalances: ApiBalanceBySlug,
    changedSlugs: string[],
  ) {
    const { balance, lastTxId } = await getWalletInfo(account.network, account.address);
    const isToncoinBalanceChanged = balance !== undefined && balance !== cache[TONCOIN.slug];
    newBalances[TONCOIN.slug] = balance;

    if (isToncoinBalanceChanged) {
      changedSlugs.push(TONCOIN.slug);
    }

    return { lastTxId, isToncoinBalanceChanged };
  }

  async function updateTokenBalances(
    account: BalancePollingAccount,
    cache: ApiBalanceBySlug,
    newBalances: ApiBalanceBySlug,
    changedSlugs: string[],
  ) {
    const tokenBalances = await getAccountTokenBalances(account.id);

    if (!activeAccountId) {
      throw new AbortOperationError();
    }
    throwErrorIfUpdaterNotAlive(localOnUpdate, activeAccountId);

    if (!tokenBalances) {
      return;
    }

    const tokens = tokenBalances.filter(Boolean).map(({ token }) => ({
      ...token,
      price: 0,
      priceUsd: 0,
      percentChange24h: 0,
    }));
    await updateTokens(tokens, onUpdate);
    await updateTokenHashes(account.network, tokens, onUpdate);

    tokenBalances.forEach(({ slug, balance: tokenBalance }) => {
      newBalances[slug] = tokenBalance;
      if (cache[slug] !== tokenBalance) {
        changedSlugs.push(slug);
      }
    });
  }

  while (isUpdaterAlive(localOnUpdate)) {
    try {
      activeAccountId = getActiveAccountId();
      await updateAddressToAccountsMap();
      for (const address of Object.keys(addressToAccountsMap)) {
        const account = addressToAccountsMap[address][0];
        const cache = lastBalanceCache[account.id] ?? {};
        const newBalances: ApiBalanceBySlug = {};
        const changedSlugs: string[] = [];

        const { isToncoinBalanceChanged } = await updateBalance(account, cache, newBalances, changedSlugs);

        if (isUpdaterAlive(localOnUpdate) && isToncoinBalanceChanged) {
          await updateTokenBalances(account, cache, newBalances, changedSlugs);

          lastBalanceCache[account.id] = newBalances;

          if (changedSlugs.length) {
            // Notify all accounts with the same address
            addressToAccountsMap[account.address].forEach((acc) => {
              onUpdate({
                type: 'updateBalances',
                accountId: acc.id,
                chain: 'ton',
                balances: newBalances,
              });
            });
          }
        }
      }
    } catch (err) {
      if (err instanceof AbortOperationError) {
        break;
      }
      logDebugError('setupBalancesPolling', err);
    }

    await pauseOrFocus(BALANCE_NOT_ACTIVE_ACCOUNTS_INTERVAL, BALANCE_NOT_ACTIVE_ACCOUNTS_INTERVAL_WHEN_NOT_FOCUSED);
  }
}

async function checkWalletInitialization(accountId: string, wallet: ApiTonWallet) {
  if (wallet.isInitialized) {
    return wallet;
  }

  const { network } = parseAccountId(accountId);
  const doesNeedPublicKey = !wallet.publicKey;
  let walletUpdate: Partial<ApiTonWallet> | undefined;

  if (doesNeedPublicKey) {
    // This branch isn't used always, because it makes more network requests than the other
    const updatedWallet = await getWalletFromAddress(network, wallet.address);
    if (!('error' in updatedWallet) && updatedWallet.wallet.isInitialized) {
      // It's important to load and save `version` along with `publicKey` because the app couldn't get the proper
      // wallet version without knowing the `publicKey`.
      walletUpdate = pick(updatedWallet.wallet, ['isInitialized', 'publicKey', 'version']);
    }
  } else {
    const isInitialized = await isAddressInitialized(network, wallet.address);
    if (isInitialized) {
      walletUpdate = { isInitialized };
    }
  }

  if (walletUpdate) {
    wallet = { ...wallet, ...walletUpdate };
    await updateStoredTonWallet(accountId, walletUpdate);
  }
  return wallet;
}

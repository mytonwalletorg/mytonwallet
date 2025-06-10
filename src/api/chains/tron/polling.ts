import type {
  ApiActivity,
  ApiActivityTimestamps,
  ApiBalanceBySlug,
  ApiNetwork,
  ApiUpdatingStatus,
  OnApiUpdate,
} from '../../types';

import { SWAP_CROSSCHAIN_SLUGS, TRX } from '../../../config';
import { parseAccountId } from '../../../util/account';
import { getChainConfig } from '../../../util/chain';
import { compareActivities } from '../../../util/compareActivities';
import isEmptyObject from '../../../util/isEmptyObject';
import { logDebugError } from '../../../util/logs';
import { pauseOrFocus } from '../../../util/pauseOrFocus';
import { fetchStoredAccounts, fetchStoredTronWallet, getActiveAccountId } from '../../common/accounts';
import { isAlive, isUpdaterAlive } from '../../common/helpers';
import { swapReplaceCexActivities } from '../../common/swap';
import { buildTokenSlug } from '../../common/tokens';
import { txCallbacks } from '../../common/txCallbacks';
import { FIRST_TRANSACTIONS_LIMIT, SEC } from '../../constants';
import { getTokenTransactionSlice, mergeActivities } from './transactions';
import { getTrc20Balance, getWalletBalance } from './wallet';

const BALANCE_INTERVAL = 1.1 * SEC;
const BALANCE_INTERVAL_WHEN_NOT_FOCUSED = 10 * SEC;
const FORCE_CHECK_ACTIVITIES_PAUSE = 30 * SEC;

const BALANCE_NOT_ACTIVE_ACCOUNTS_INTERVAL = 30 * SEC;
const BALANCE_NOT_ACTIVE_ACCOUNTS_INTERVAL_WHEN_NOT_FOCUSED = 60 * SEC;

let inactiveAccountsCache: Record<string, ApiBalanceBySlug> = {};

export async function setupPolling(
  accountId: string,
  onUpdate: OnApiUpdate,
  onUpdatingStatusChange: (kind: ApiUpdatingStatus['kind'], isUpdating: boolean) => void,
  newestActivityTimestamps: ApiActivityTimestamps,
) {
  const cache: ApiBalanceBySlug = {};
  const { network } = parseAccountId(accountId);
  const { address } = await fetchStoredTronWallet(accountId);

  const { usdtAddress } = getChainConfig('tron')[network];
  const usdtSlug = buildTokenSlug('tron', usdtAddress);
  const slugs = [TRX.slug, usdtSlug];

  let forceCheckActivitiesTime = 0;

  async function updateActivities(isBalanceChanged: boolean) {
    if (!isBalanceChanged && forceCheckActivitiesTime > Date.now()) {
      return;
    }

    // Some Tron operations don't change the balance, so we poll the activities periodically just in case.
    forceCheckActivitiesTime = Date.now() + FORCE_CHECK_ACTIVITIES_PAUSE;

    if (isEmptyObject(newestActivityTimestamps)) {
      newestActivityTimestamps = await loadInitialActivities(accountId, slugs, onUpdate);
    } else {
      newestActivityTimestamps = await loadNewActivities(accountId, newestActivityTimestamps, slugs, onUpdate);
    }
  }

  while (isAlive(onUpdate, accountId)) {
    try {
      onUpdatingStatusChange('balance', true);
      onUpdatingStatusChange('activities', true);

      const [trxBalance, usdtBalance] = await Promise.all([
        getWalletBalance(network, address),
        getTrc20Balance(network, usdtAddress, address),
      ]);

      const isBalanceChanged = trxBalance !== cache[TRX.slug]
        || usdtBalance !== cache[usdtAddress];

      if (isBalanceChanged) {
        onUpdate({
          type: 'updateBalances',
          accountId,
          chain: 'tron',
          balances: {
            [TRX.slug]: trxBalance,
            [usdtSlug]: usdtBalance,
          },
        });
      }

      onUpdatingStatusChange('balance', false);

      await updateActivities(isBalanceChanged);

      onUpdatingStatusChange('activities', false);

      cache[TRX.slug] = trxBalance;
      cache[usdtAddress] = usdtBalance;
    } catch (err) {
      logDebugError('tron:setupPolling', err);
    } finally {
      onUpdatingStatusChange('balance', false);
      onUpdatingStatusChange('activities', false);
    }

    await pauseOrFocus(BALANCE_INTERVAL, BALANCE_INTERVAL_WHEN_NOT_FOCUSED);
  }
}

export async function setupInactiveAccountsBalancePolling(onUpdate: OnApiUpdate) {
  while (isUpdaterAlive(onUpdate)) {
    try {
      const accountsById = await fetchStoredAccounts();
      const activeAccountId = getActiveAccountId();

      for (const [accountId, account] of Object.entries(accountsById)) {
        if (accountId === activeAccountId || !('tron' in account) || !account.tron) {
          continue;
        }

        const { network } = parseAccountId(accountId);
        const { address } = account.tron;

        const { usdtAddress } = getChainConfig('tron')[network];
        const usdtSlug = buildTokenSlug('tron', usdtAddress);

        const [trxBalance, usdtBalance] = await Promise.all([
          getWalletBalance(network, address),
          getTrc20Balance(network, usdtAddress, address),
        ]);

        if (
          trxBalance !== inactiveAccountsCache[accountId][TRX.slug]
          || usdtBalance !== inactiveAccountsCache[accountId][usdtSlug]
        ) {
          onUpdate({
            type: 'updateBalances',
            accountId,
            chain: 'tron',
            balances: {
              [TRX.slug]: trxBalance,
              [usdtSlug]: usdtBalance,
            },
          });

          inactiveAccountsCache[accountId][TRX.slug] = trxBalance;
          inactiveAccountsCache[accountId][usdtSlug] = usdtBalance;
        }
      }
    } catch (err) {
      logDebugError('tron:setupPolling', err);
    }

    await pauseOrFocus(BALANCE_NOT_ACTIVE_ACCOUNTS_INTERVAL, BALANCE_NOT_ACTIVE_ACCOUNTS_INTERVAL_WHEN_NOT_FOCUSED);
  }
}

async function loadInitialActivities(
  accountId: string,
  tokenSlugs: string[],
  onUpdate: OnApiUpdate,
) {
  const result: ApiActivityTimestamps = {};
  const bySlug: Record<string, ApiActivity[]> = {};

  const chunks = await Promise.all(tokenSlugs.map(async (slug) => {
    let activities: ApiActivity[] = await getTokenTransactionSlice(
      accountId, slug, undefined, undefined, FIRST_TRANSACTIONS_LIMIT,
    );

    if (SWAP_CROSSCHAIN_SLUGS.has(slug)) {
      activities = await swapReplaceCexActivities(accountId, activities, slug, true);
    }

    result[slug] = activities[0]?.timestamp;
    bySlug[slug] = activities;

    return activities;
  }));

  const [trxChunk, ...tokenChunks] = chunks;
  const mainActivities = mergeActivities(trxChunk, tokenChunks.flat())
    .flat()
    .sort(compareActivities);

  mainActivities.slice().reverse().forEach((transaction) => {
    txCallbacks.runCallbacks(transaction);
  });

  onUpdate({
    type: 'initialActivities',
    chain: 'tron',
    accountId,
    mainActivities,
    bySlug,
  });

  return result;
}

async function loadNewActivities(
  accountId: string,
  newestActivityTimestamps: ApiActivityTimestamps,
  tokenSlugs: string[],
  onUpdate: OnApiUpdate,
) {
  const result: ApiActivityTimestamps = {};

  const chunks = await Promise.all(tokenSlugs.map(async (slug) => {
    let newestActivityTimestamp = newestActivityTimestamps[slug];
    let activities: ApiActivity[] = await getTokenTransactionSlice(
      accountId, slug, undefined, newestActivityTimestamp, FIRST_TRANSACTIONS_LIMIT,
    );

    if (SWAP_CROSSCHAIN_SLUGS.has(slug)) {
      activities = await swapReplaceCexActivities(accountId, activities, slug, true);
    }

    newestActivityTimestamp = activities[0]?.timestamp ?? newestActivityTimestamp;
    result[slug] = newestActivityTimestamp;
    return activities;
  }));

  const [trxChunk, ...tokenChunks] = chunks;
  const activities = mergeActivities(trxChunk, tokenChunks.flat())
    .flat()
    .sort(compareActivities);

  activities.slice().reverse().forEach((activity) => {
    txCallbacks.runCallbacks(activity);
  });

  onUpdate({
    type: 'newActivities',
    chain: 'tron',
    activities,
    accountId,
  });

  return result;
}

export function clearAccountsCache() {
  inactiveAccountsCache = {};
}

export function clearAccountsCacheByNetwork(network: ApiNetwork) {
  for (const accountId of Object.keys(inactiveAccountsCache)) {
    if (parseAccountId(accountId).network === network) {
      clearAccountCache(accountId);
    }
  }
}

export function clearAccountCache(accountId: string) {
  delete inactiveAccountsCache[accountId];
}

import type { ApiActivity, ApiActivityTimestamps, ApiBalanceBySlug, ApiUpdatingStatus, OnApiUpdate } from '../../types';

import { TRX } from '../../../config';
import { parseAccountId } from '../../../util/account';
import { getChainConfig } from '../../../util/chain';
import { compareActivities } from '../../../util/compareActivities';
import isEmptyObject from '../../../util/isEmptyObject';
import { logDebugError } from '../../../util/logs';
import { pauseOrFocus } from '../../../util/pauseOrFocus';
import { fetchStoredAccounts, fetchStoredTronWallet, getActiveAccountId } from '../../common/accounts';
import { isAlive, isUpdaterAlive } from '../../common/helpers';
import { buildTokenSlug } from '../../common/tokens';
import { txCallbacks } from '../../common/txCallbacks';
import { FIRST_TRANSACTIONS_LIMIT, SEC } from '../../constants';
import { getTokenTransactionSlice, mergeTransactions } from './transactions';
import { getTrc20Balance, getWalletBalance } from './wallet';

const BALANCE_INTERVAL = 1.1 * SEC;
const BALANCE_INTERVAL_WHEN_NOT_FOCUSED = 10 * SEC;
const FORCE_CHECK_ACTIVITIES_PAUSE = 30 * SEC;

const BALANCE_NOT_ACTIVE_ACCOUNTS_INTERVAL = 30 * SEC;
const BALANCE_NOT_ACTIVE_ACCOUNTS_INTERVAL_WHEN_NOT_FOCUSED = 60 * SEC;

const lastBalanceCache: Record<string, ApiBalanceBySlug> = {};

export async function setupPolling(
  accountId: string,
  onUpdate: OnApiUpdate,
  onUpdatingStatusChange: (kind: ApiUpdatingStatus['kind'], isUpdating: boolean) => void,
  newestActivityTimestamps: ApiActivityTimestamps,
) {
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

      if (!lastBalanceCache[accountId]) lastBalanceCache[accountId] = {};
      const accountLastBalances = lastBalanceCache[accountId];

      const [trxBalance, usdtBalance] = await Promise.all([
        getWalletBalance(network, address),
        getTrc20Balance(network, usdtAddress, address),
      ]);

      const isBalanceChanged = trxBalance !== accountLastBalances[TRX.slug]
        || usdtBalance !== accountLastBalances[usdtAddress];

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

      accountLastBalances[TRX.slug] = trxBalance;
      accountLastBalances[usdtAddress] = usdtBalance;
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

        if (!lastBalanceCache[accountId]) lastBalanceCache[accountId] = {};
        const accountLastBalances = lastBalanceCache[accountId];

        if (trxBalance !== accountLastBalances[TRX.slug] || usdtBalance !== accountLastBalances[usdtSlug]) {
          onUpdate({
            type: 'updateBalances',
            accountId,
            chain: 'tron',
            balances: {
              [TRX.slug]: trxBalance,
              [usdtSlug]: usdtBalance,
            },
          });

          accountLastBalances[TRX.slug] = trxBalance;
          accountLastBalances[usdtSlug] = usdtBalance;
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
    const transactions = await getTokenTransactionSlice(
      accountId, slug, undefined, undefined, FIRST_TRANSACTIONS_LIMIT,
    );

    result[slug] = transactions[0]?.timestamp;
    bySlug[slug] = transactions;

    return transactions;
  }));

  const [trxChunk, ...tokenChunks] = chunks;
  const mainActivities = mergeTransactions(trxChunk, tokenChunks.flat())
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
    const transactions = await getTokenTransactionSlice(
      accountId, slug, undefined, newestActivityTimestamp, FIRST_TRANSACTIONS_LIMIT,
    );
    newestActivityTimestamp = transactions[0]?.timestamp ?? newestActivityTimestamp;
    result[slug] = newestActivityTimestamp;
    return transactions;
  }));

  const [trxChunk, ...tokenChunks] = chunks;
  const transactions = mergeTransactions(trxChunk, tokenChunks.flat())
    .flat()
    .sort(compareActivities);

  transactions.slice().reverse().forEach((transaction) => {
    txCallbacks.runCallbacks(transaction);
  });

  onUpdate({
    type: 'newActivities',
    chain: 'tron',
    activities: transactions,
    accountId,
  });

  return result;
}

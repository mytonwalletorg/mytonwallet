import type { ApiActivity, ApiActivityTimestamps, ApiBalanceBySlug, OnApiUpdate } from '../../types';

import { TRX } from '../../../config';
import { parseAccountId } from '../../../util/account';
import { getChainConfig } from '../../../util/chain';
import { compareActivities } from '../../../util/compareActivities';
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

const BALANCE_NOT_ACTIVE_ACCOUNTS_INTERVAL = 30 * SEC;
const BALANCE_NOT_ACTIVE_ACCOUNTS_INTERVAL_WHEN_NOT_FOCUSED = 60 * SEC;

const lastBalanceCache: Record<string, ApiBalanceBySlug> = {};

export async function setupPolling(
  accountId: string,
  onUpdate: OnApiUpdate,
  newestActivityTimestamps: ApiActivityTimestamps,
) {
  const { network } = parseAccountId(accountId);
  const { address } = await fetchStoredTronWallet(accountId);

  const { usdtAddress } = getChainConfig('tron')[network];
  const usdtSlug = buildTokenSlug('tron', usdtAddress);
  const slugs = [TRX.slug, usdtSlug];

  while (isAlive(onUpdate, accountId)) {
    try {
      if (!lastBalanceCache[accountId]) lastBalanceCache[accountId] = {};
      const accountLastBalances = lastBalanceCache[accountId];

      const [trxBalance, usdtBalance] = await Promise.all([
        getWalletBalance(network, address),
        getTrc20Balance(network, usdtAddress, address),
      ]);

      if (trxBalance !== accountLastBalances[TRX.slug] || usdtBalance !== accountLastBalances[usdtAddress]) {
        onUpdate({
          type: 'updateBalances',
          accountId,
          chain: 'tron',
          balances: {
            [TRX.slug]: trxBalance,
            [usdtSlug]: usdtBalance,
          },
        });

        newestActivityTimestamps = await processNewActivities(accountId, newestActivityTimestamps, slugs, onUpdate);
        accountLastBalances[TRX.slug] = trxBalance;
        accountLastBalances[usdtAddress] = usdtBalance;
      }
    } catch (err) {
      logDebugError('tron:setupPolling', err);
    }

    await pauseOrFocus(BALANCE_INTERVAL, BALANCE_INTERVAL_WHEN_NOT_FOCUSED);
  }
}

export async function setupInactiveAccountsBalancePolling(onUpdate: OnApiUpdate) {
  while (isUpdaterAlive(onUpdate)) {
    try {
      const accountsById = await fetchStoredAccounts();
      const activeAccountId = getActiveAccountId();

      for (const [accountId] of Object.entries(accountsById)
        .filter(([id, acc]) => acc.type === 'bip39' && id !== activeAccountId)) {
        const { network } = parseAccountId(accountId);
        const { address } = await fetchStoredTronWallet(accountId);

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

async function processNewActivities(
  accountId: string,
  newestActivityTimestamps: ApiActivityTimestamps,
  tokenSlugs: string[],
  onUpdate: OnApiUpdate,
) {
  const result: ApiActivityTimestamps = {};
  const bySlug: Record<string, ApiActivity[]> = {};

  const chunks = await Promise.all(tokenSlugs.map(async (slug) => {
    const newestActivityTimestamp = newestActivityTimestamps[slug];
    const transactions = await getTokenTransactionSlice(
      accountId, slug, undefined, newestActivityTimestamp, FIRST_TRANSACTIONS_LIMIT,
    );

    result[slug] = transactions[0]?.timestamp ?? newestActivityTimestamp;
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
    bySlug,
    mainActivities,
  });

  return result;
}

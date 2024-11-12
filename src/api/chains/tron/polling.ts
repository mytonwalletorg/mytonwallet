import type { ApiTxTimestamps, OnApiUpdate } from '../../types';

import { TRX } from '../../../config';
import { parseAccountId } from '../../../util/account';
import { getChainConfig } from '../../../util/chain';
import { compareActivities } from '../../../util/compareActivities';
import { logDebugError } from '../../../util/logs';
import { pauseOrFocus } from '../../../util/pauseOrFocus';
import { fetchStoredTronWallet } from '../../common/accounts';
import { isAlive } from '../../common/helpers';
import { buildTokenSlug } from '../../common/tokens';
import { txCallbacks } from '../../common/txCallbacks';
import { FIRST_TRANSACTIONS_LIMIT, SEC } from '../../constants';
import { getTokenTransactionSlice, mergeTransactions } from './transactions';
import { getTrc20Balance, getWalletBalance } from './wallet';

const BALANCE_INTERVAL = 1.1 * SEC;
const BALANCE_INTERVAL_WHEN_NOT_FOCUSED = 10 * SEC;

export async function setupPolling(accountId: string, onUpdate: OnApiUpdate, newestTxTimestamps: ApiTxTimestamps) {
  const { network } = parseAccountId(accountId);
  const { address } = await fetchStoredTronWallet(accountId);

  const { usdtAddress } = getChainConfig('tron')[network];
  const usdtSlug = buildTokenSlug('tron', usdtAddress);
  const slugs = [TRX.slug, usdtSlug];

  let lastTrxBalance: bigint | undefined;
  let lastUsdtBalance: bigint | undefined;

  while (isAlive(onUpdate, accountId)) {
    try {
      const [trxBalance, usdtBalance] = await Promise.all([
        getWalletBalance(network, address),
        getTrc20Balance(network, usdtAddress, address),
      ]);

      if (trxBalance !== lastTrxBalance || usdtBalance !== lastUsdtBalance) {
        onUpdate({
          type: 'updateBalances',
          accountId,
          chain: 'tron',
          balances: {
            [TRX.slug]: trxBalance,
            [usdtSlug]: usdtBalance,
          },
        });

        newestTxTimestamps = await processNewActivities(accountId, newestTxTimestamps, slugs, onUpdate);
        lastTrxBalance = trxBalance;
        lastUsdtBalance = usdtBalance;
      }
    } catch (err) {
      logDebugError('tron:setupPolling', err);
    }

    await pauseOrFocus(BALANCE_INTERVAL, BALANCE_INTERVAL_WHEN_NOT_FOCUSED);
  }
}

async function processNewActivities(
  accountId: string,
  newestTxTimestamps: ApiTxTimestamps,
  tokenSlugs: string[],
  onUpdate: OnApiUpdate,
) {
  const result: ApiTxTimestamps = {};

  const chunks = await Promise.all(tokenSlugs.map(async (slug) => {
    let newestTxTimestamp = newestTxTimestamps[slug];
    const transactions = await getTokenTransactionSlice(
      accountId, slug, undefined, newestTxTimestamp, FIRST_TRANSACTIONS_LIMIT,
    );
    if (transactions.length) {
      newestTxTimestamp = transactions[0]!.timestamp;
    }
    result[slug] = newestTxTimestamp;
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

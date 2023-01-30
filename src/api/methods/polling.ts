import blockchains from '../blockchains';
import { isUpdaterAlive, resolveBlockchainKey } from '../common/helpers';
import { txCallbacks } from '../common/txCallbacks';
import { pause } from '../../util/schedulers';
import {
  APP_VERSION,
  BRILLIANT_API_BASE_URL,
  DEBUG,
  TON_TOKEN_SLUG,
} from '../../config';
import { Storage } from '../storages/types';
import { ApiInitArgs, ApiToken, OnApiUpdate } from '../types';
import { buildCollectionByKey } from '../../util/iteratees';
import { cloneDeep } from '../blockchains/ton/util';
import { getKnownTokens } from '../blockchains/ton/tokens';
import { getPoolState } from './staking';

type IsAccountActiveFn = (accountId: string) => boolean;

const POLLING_INTERVAL = 1100; // 1.1 sec
const PRICES_POLLING_INTERVAL = 30000; // 30 sec
const STAKING_INFO_POLLING_INTERVAL = 60000; // 1 min

let onUpdate: OnApiUpdate;
let storage: Storage;
let isAccountActive: IsAccountActiveFn;
let origin: string;

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
}

// TODO Switching back/to Testnet always creates a new polling loop but never breaks the previous one
export async function setupBalancePolling(accountId: string, newestTxId?: string) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  if (!newestTxId) {
    newestTxId = await blockchain.getAccountNewestTxId(storage, accountId);
  }

  delete lastBalanceCache[accountId];

  while (isUpdaterAlive(onUpdate) && isAccountActive(accountId)) {
    try {
      const [balance, tokenBalances, stakingState] = await Promise.all([
        blockchain.getAccountBalance(storage, accountId).catch(logAndRescue),
        blockchain.getAccountTokenBalances(storage, accountId).catch(logAndRescue),
        blockchain.getStakingState(storage, accountId).catch(logAndRescue),
      ]);
      if (!isUpdaterAlive(onUpdate) || !isAccountActive(accountId)) return;

      const cache = lastBalanceCache[accountId];
      let isBalanceChanged = false;

      if (balance && balance !== cache?.balance) {
        isBalanceChanged = true;
        onUpdate({
          type: 'updateBalance',
          accountId,
          slug: TON_TOKEN_SLUG,
          balance,
        });
      }

      if (tokenBalances) {
        // Process new tokens
        const tokens = getKnownTokens();
        let areNewTokensFound = false;

        for (const { token } of tokenBalances) {
          if (token.slug in tokens) continue;

          areNewTokensFound = true;
          tokens[token.slug] = {
            ...token,
            quote: {
              price: 0.0,
              percentChange1h: 0.0,
              percentChange24h: 0.0,
              percentChange7d: 0.0,
              percentChange30d: 0.0,
            },
          } as ApiToken;
        }

        if (areNewTokensFound) {
          onUpdate({
            type: 'updateTokens',
            tokens: cloneDeep(tokens),
          });
        }

        // Process balances
        for (const { slug, balance: tokenBalance } of tokenBalances) {
          if (tokenBalance === (cache?.tokenBalances || {})[slug]) continue;

          isBalanceChanged = true;
          onUpdate({
            type: 'updateBalance',
            accountId,
            slug,
            balance: tokenBalance,
          });
        }
      }

      if (stakingState) {
        onUpdate({
          type: 'updateStakingState',
          accountId,
          stakingState,
        });
      }

      if (isBalanceChanged) {
        newestTxId = await fetchNewTransactions(accountId, newestTxId);
      }

      lastBalanceCache[accountId] = {
        balance,
        tokenBalances: tokenBalances && Object.fromEntries(tokenBalances.map(
          ({ slug, balance: tokenBalance }) => [slug, tokenBalance],
        )),
      };
    } catch (err) {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.error('[setupBalancePolling]', err);
      }
    }

    await pause(POLLING_INTERVAL);
  }
}

async function fetchNewTransactions(accountId: string, newestTxId?: string) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  const transactions = await blockchain.getAccountTransactionSlice(
    storage,
    accountId,
    undefined,
    newestTxId,
  );

  if (transactions.length) {
    newestTxId = transactions[0].txId;

    // eslint-disable-next-line @typescript-eslint/no-loop-func
    transactions.reverse().forEach((transaction) => {
      txCallbacks.runCallbacks(transaction);

      onUpdate({
        type: 'newTransaction',
        transaction,
        accountId,
      });
    });
  }

  return newestTxId;
}

export async function setupPricesPolling() {
  while (isUpdaterAlive(onUpdate)) {
    try {
      const data = await fetch(`${BRILLIANT_API_BASE_URL}/prices`, {
        headers: {
          'X-App-Origin': origin,
          'X-App-Version': APP_VERSION,
        },
      });
      if (!isUpdaterAlive(onUpdate)) return;
      if (!data.ok) {
        await pause(POLLING_INTERVAL);
        continue;
      }
      const prices = (await data.json()) as Record<string, ApiToken>;
      const pricesById = buildCollectionByKey(Object.values(prices), 'id');
      const tokens = getKnownTokens();

      Object.values(tokens).forEach((token) => {
        if (!token.id) return;
        token.quote = pricesById[token.id].quote;
      });

      onUpdate({
        type: 'updateTokens',
        tokens: cloneDeep(tokens),
      });
    } catch (err) {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.error('Error fetching tokens', err);
      }
    }

    await pause(PRICES_POLLING_INTERVAL);
  }
}

export async function setupPoolStatePolling(accountId: string) {
  while (isUpdaterAlive(onUpdate) && isAccountActive(accountId)) {
    try {
      const poolState = await getPoolState(accountId);
      if (!isUpdaterAlive(onUpdate) || !isAccountActive(accountId)) return;

      if (poolState) {
        onUpdate({
          type: 'updatePoolState',
          poolState,
        });
      }
    } catch (err) {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.error('Error fetching staking info', err);
      }
    }

    await pause(STAKING_INFO_POLLING_INTERVAL);
  }
}

function logAndRescue(err: Error) {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.error('Polling error', err);
  }

  return undefined;
}

import type { ApiNetwork, ApiSwapAsset, ApiTxIdBySlug } from '../../api/types';
import type {
  Account,
  AccountSettings,
  AccountState,
  GlobalState,
  UserSwapToken,
  UserToken,
} from '../types';

import { TON_TOKEN_SLUG } from '../../config';
import { parseAccountId } from '../../util/account';
import { findLast, mapValues } from '../../util/iteratees';
import memoized from '../../util/memoized';
import { round } from '../../util/round';
import { bigStrToHuman, getIsSwapId, getIsTxIdLocal } from '../helpers';

export function selectHasSession(global: GlobalState) {
  return Boolean(global.currentAccountId);
}

const selectAccountTokensMemoized = memoized((
  balancesBySlug: Record<string, string>,
  tokenInfo: GlobalState['tokenInfo'],
  accountSettings: AccountSettings,
  isSortByValueEnabled: boolean = false,
  areTokensWithNoBalanceHidden: boolean = false,
  areTokensWithNoPriceHidden: boolean = false,
) => {
  const getTotalValue = ({ price, amount }: UserToken) => price * amount;

  return Object
    .entries(balancesBySlug)
    .filter(([slug]) => (slug in tokenInfo.bySlug))
    .map(([slug, balance]) => {
      const {
        symbol, name, image, decimals, cmcSlug, quote: {
          price, percentChange24h, percentChange7d, percentChange30d, history7d, history24h, history30d,
        },
      } = tokenInfo.bySlug[slug];
      const amount = bigStrToHuman(balance, decimals);
      const isException = accountSettings.exceptionSlugs?.includes(slug);
      let isDisabled = (areTokensWithNoPriceHidden && price === 0)
        || (areTokensWithNoBalanceHidden && amount === 0);

      if (isException) {
        isDisabled = !isDisabled;
      }

      if (slug === TON_TOKEN_SLUG) {
        isDisabled = false;
      }

      return {
        symbol,
        slug,
        amount,
        name,
        image,
        price,
        decimals,
        change24h: round(percentChange24h / 100, 4),
        change7d: round(percentChange7d / 100, 4),
        change30d: round(percentChange30d / 100, 4),
        history24h,
        history7d,
        history30d,
        isDisabled,
        cmcSlug,
      } as UserToken;
    })
    .sort((tokenA, tokenB) => {
      if (isSortByValueEnabled) {
        return getTotalValue(tokenB) - getTotalValue(tokenA);
      }

      if (!accountSettings.orderedSlugs) {
        return 1;
      }

      const indexA = accountSettings.orderedSlugs.indexOf(tokenA.slug);
      const indexB = accountSettings.orderedSlugs.indexOf(tokenB.slug);
      return indexA - indexB;
    });
});

export function selectCurrentAccountTokens(global: GlobalState) {
  const balancesBySlug = selectCurrentAccountState(global)?.balances?.bySlug;
  if (!balancesBySlug || !global.tokenInfo) {
    return undefined;
  }

  const accountSettings = selectAccountSettings(global, global.currentAccountId!) ?? {};
  const { areTokensWithNoBalanceHidden, areTokensWithNoPriceHidden, isSortByValueEnabled } = global.settings;

  return selectAccountTokensMemoized(
    balancesBySlug,
    global.tokenInfo,
    accountSettings,
    isSortByValueEnabled,
    areTokensWithNoBalanceHidden,
    areTokensWithNoPriceHidden,
  );
}

function createTokenList(
  swapTokenInfo: GlobalState['swapTokenInfo'],
  balancesBySlug: Record<string, string>,
  sortFn: (tokenA: ApiSwapAsset, tokenB: ApiSwapAsset) => number,
  filterFn?: (token: ApiSwapAsset) => boolean,
): UserSwapToken[] {
  return Object.entries(swapTokenInfo.bySlug)
    .filter(([, token]) => !filterFn || filterFn(token))
    .map(([slug, {
      symbol, name, image, decimals, keywords, blockchain, contract, isPopular,
    }]) => {
      const amount = bigStrToHuman(balancesBySlug[slug] ?? '0', decimals);
      return {
        symbol,
        slug,
        amount,
        name,
        image,
        decimals,
        isDisabled: false,
        canSwap: true,
        isPopular,
        keywords,
        blockchain,
        contract,
      } satisfies UserSwapToken;
    })
    .sort(sortFn);
}

const selectPopularTokensMemoized = memoized(
  (balancesBySlug: Record<string, string>, swapTokenInfo: GlobalState['swapTokenInfo']) => {
    const popularTokenOrder = [
      'TON',
      'BTC',
      'ETH',
      'USDT',
      'jUSDT',
      'jWBTC',
    ];
    const orderMap = new Map(popularTokenOrder.map((item, index) => [item, index]));

    const filterFn = (token: ApiSwapAsset) => token.isPopular;
    const sortFn = (tokenA: ApiSwapAsset, tokenB: ApiSwapAsset) => {
      const orderIndexA = orderMap.has(tokenA.symbol) ? orderMap.get(tokenA.symbol)! : popularTokenOrder.length;
      const orderIndexB = orderMap.has(tokenB.symbol) ? orderMap.get(tokenB.symbol)! : popularTokenOrder.length;

      return orderIndexA - orderIndexB;
    };
    return createTokenList(swapTokenInfo, balancesBySlug, sortFn, filterFn);
  },
);

const selectSwapTokensMemoized = memoized(
  (balancesBySlug: Record<string, string>, swapTokenInfo: GlobalState['swapTokenInfo']) => {
    const sortFn = (tokenA: ApiSwapAsset, tokenB: ApiSwapAsset) => (
      tokenA.name.trim().toLowerCase().localeCompare(tokenB.name.trim().toLowerCase())
    );
    return createTokenList(swapTokenInfo, balancesBySlug, sortFn);
  },
);

const selectAccountTokensForSwapMemoized = memoized((
  balancesBySlug: Record<string, string>,
  tokenInfo: GlobalState['tokenInfo'],
  swapTokenInfo: GlobalState['swapTokenInfo'],
  accountSettings: AccountSettings,
  isSortByValueEnabled = false,
  areTokensWithNoBalanceHidden = false,
  areTokensWithNoPriceHidden = false,
) => {
  return selectAccountTokensMemoized(
    balancesBySlug,
    tokenInfo,
    accountSettings,
    isSortByValueEnabled,
    areTokensWithNoBalanceHidden,
    areTokensWithNoPriceHidden,
  ).filter((token) => token.slug in swapTokenInfo.bySlug && !token.isDisabled);
});

export function selectAvailableUserForSwapTokens(global: GlobalState) {
  const balancesBySlug = selectCurrentAccountState(global)?.balances?.bySlug;
  if (!balancesBySlug || !global.tokenInfo || !global.swapTokenInfo) {
    return undefined;
  }

  const accountSettings = selectAccountSettings(global, global.currentAccountId!) ?? {};
  const { areTokensWithNoBalanceHidden, areTokensWithNoPriceHidden, isSortByValueEnabled } = global.settings;

  return selectAccountTokensForSwapMemoized(
    balancesBySlug,
    global.tokenInfo,
    global.swapTokenInfo,
    accountSettings,
    isSortByValueEnabled,
    areTokensWithNoBalanceHidden,
    areTokensWithNoPriceHidden,
  );
}

export function selectPopularTokens(global: GlobalState) {
  const balancesBySlug = selectCurrentAccountState(global)?.balances?.bySlug;
  if (!balancesBySlug || !global.swapTokenInfo) {
    return undefined;
  }

  return selectPopularTokensMemoized(balancesBySlug, global.swapTokenInfo);
}

export function selectSwapTokens(global: GlobalState) {
  const balancesBySlug = selectCurrentAccountState(global)?.balances?.bySlug;
  if (!balancesBySlug || !global.swapTokenInfo) {
    return undefined;
  }

  return selectSwapTokensMemoized(
    balancesBySlug,
    global.swapTokenInfo,
  );
}

export function selectIsNewWallet(global: GlobalState) {
  const tokens = selectCurrentAccountTokens(global);

  return tokens?.length === 0 || (tokens?.length === 1 && tokens[0].amount === 0);
}

export function selectAccounts(global: GlobalState) {
  return global.accounts?.byId;
}

export const selectNetworkAccountsMemoized = memoized((network: ApiNetwork, accountsById?: Record<string, Account>) => {
  if (!accountsById) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(accountsById).filter(([accountId]) => parseAccountId(accountId).network === network),
  );
});

export function selectNetworkAccounts(global: GlobalState) {
  return selectNetworkAccountsMemoized(selectCurrentNetwork(global), global.accounts?.byId);
}

export function selectCurrentNetwork(global: GlobalState) {
  return global.settings.isTestnet ? 'testnet' : 'mainnet';
}

export function selectCurrentAccount(global: GlobalState) {
  return selectAccount(global, global.currentAccountId!);
}

export function selectAccount(global: GlobalState, accountId: string) {
  return selectAccounts(global)?.[accountId];
}

export function selectCurrentAccountState(global: GlobalState) {
  return selectAccountState(global, global.currentAccountId!);
}

export function selectAccountState(global: GlobalState, accountId: string): AccountState | undefined {
  return global.byAccountId[accountId];
}

export function selectFirstNonHardwareAccount(global: GlobalState) {
  const accounts = selectAccounts(global);

  if (!accounts) {
    return undefined;
  }

  return Object.values(accounts).find((account) => !account.isHardware);
}

export function selectNewestTxIds(global: GlobalState, accountId: string): ApiTxIdBySlug {
  return mapValues(
    selectAccountState(global, accountId)?.activities?.newestTransactionsBySlug || {},
    ({ txId }) => txId,
  );
}

export function selectLastTxIds(global: GlobalState, accountId: string): ApiTxIdBySlug {
  const idsBySlug = selectAccountState(global, accountId)?.activities?.idsBySlug || {};

  return Object.entries(idsBySlug).reduce((result, [slug, ids]) => {
    const txId = findLast(ids, (id) => !getIsTxIdLocal(id) && !getIsSwapId(id));
    if (txId) result[slug] = txId;
    return result;
  }, {} as ApiTxIdBySlug);
}

export function selectAccountSettings(global: GlobalState, accountId: string): AccountSettings | undefined {
  return global.settings.byAccountId[accountId];
}

export function selectIsHardwareAccount(global: GlobalState) {
  const state = selectAccount(global, global.currentAccountId!);

  return state?.isHardware;
}

export function selectAllHardwareAccounts(global: GlobalState) {
  const accounts = selectAccounts(global);

  if (!accounts) {
    return undefined;
  }

  return Object.values(accounts).filter((account) => account.isHardware);
}

export function selectIsOneAccount(global: GlobalState) {
  return Object.keys(selectAccounts(global) || {}).length === 1;
}

export const selectEnabledTokensCountMemoized = memoized((tokens?: UserToken[]) => {
  return (tokens ?? []).filter(({ isDisabled }) => !isDisabled).length;
});

export function selectLedgerAccountIndexToImport(global: GlobalState) {
  const hardwareAccounts = selectAllHardwareAccounts(global) ?? [];
  const hardwareAccountIndexes = hardwareAccounts?.map((account) => account.ledger!.index)
    .sort((a, b) => a - b);

  if (hardwareAccountIndexes.length === 0 || hardwareAccountIndexes[0] !== 0) {
    return -1;
  }

  if (hardwareAccountIndexes.length === 1) {
    return 0;
  }

  for (let i = 1; i < hardwareAccountIndexes.length; i++) {
    if (hardwareAccountIndexes[i] - hardwareAccountIndexes[i - 1] !== 1) {
      return i - 1;
    }
  }

  return hardwareAccountIndexes.length - 1;
}

export function selectLocalTransactions(global: GlobalState, accountId: string) {
  const accountState = global.byAccountId?.[accountId];

  return accountState?.activities?.localTransactions;
}

export function selectIsPasswordPresent(global: GlobalState) {
  return !!selectFirstNonHardwareAccount(global);
}

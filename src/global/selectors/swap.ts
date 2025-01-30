import type { ApiBalanceBySlug, ApiSwapAsset } from '../../api/types';
import type { AccountSettings, GlobalState, UserSwapToken } from '../types';

import { toBig } from '../../util/decimals';
import memoize from '../../util/memoize';
import withCache from '../../util/withCache';
import { selectCurrentAccountSettings, selectCurrentAccountState } from './accounts';
import { selectAccountTokensMemoizedFor } from './tokens';

function createTokenList(
  swapTokenInfo: GlobalState['swapTokenInfo'],
  balancesBySlug: ApiBalanceBySlug,
  sortFn: (tokenA: ApiSwapAsset, tokenB: ApiSwapAsset) => number,
  filterFn?: (token: ApiSwapAsset) => boolean,
): UserSwapToken[] {
  return Object.entries(swapTokenInfo.bySlug)
    .filter(([, token]) => !filterFn || filterFn(token))
    .map(([slug, {
      symbol, name, image,
      decimals, keywords, chain,
      tokenAddress, isPopular, color, price = 0, priceUsd = 0,
    }]) => {
      const amount = balancesBySlug[slug] ?? 0n;
      const totalValue = toBig(amount, decimals).mul(price).toString();

      return {
        symbol,
        slug,
        amount,
        price,
        priceUsd,
        name,
        image,
        decimals,
        isDisabled: false,
        canSwap: true,
        isPopular,
        keywords,
        totalValue,
        color,
        chain,
        tokenAddress,
      } satisfies UserSwapToken;
    })
    .sort(sortFn);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const selectPopularTokensMemoizedFor = withCache((accountId: string) => memoize(
  (balancesBySlug: ApiBalanceBySlug, swapTokenInfo: GlobalState['swapTokenInfo']) => {
    const popularTokenOrder = [
      'TON',
      'USD₮',
      'USDT',
      'BTC',
      'ETH',
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
));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const selectSwapTokensMemoizedFor = withCache((accountId: string) => memoize(
  (balancesBySlug: ApiBalanceBySlug, swapTokenInfo: GlobalState['swapTokenInfo']) => {
    const sortFn = (tokenA: ApiSwapAsset, tokenB: ApiSwapAsset) => (
      tokenA.name.trim().toLowerCase().localeCompare(tokenB.name.trim().toLowerCase())
    );
    return createTokenList(swapTokenInfo, balancesBySlug, sortFn);
  },
));

const selectAccountTokensForSwapMemoizedFor = withCache((accountId: string) => memoize((
  balancesBySlug: ApiBalanceBySlug,
  tokenInfo: GlobalState['tokenInfo'],
  swapTokenInfo: GlobalState['swapTokenInfo'],
  accountSettings: AccountSettings,
  isSortByValueEnabled = false,
  areTokensWithNoCostHidden = false,
) => {
  return selectAccountTokensMemoizedFor(accountId)(
    balancesBySlug,
    tokenInfo,
    accountSettings,
    isSortByValueEnabled,
    areTokensWithNoCostHidden,
  ).filter((token) => token.slug in swapTokenInfo.bySlug && !token.isDisabled);
}));

export function selectAvailableUserForSwapTokens(global: GlobalState) {
  const balancesBySlug = selectCurrentAccountState(global)?.balances?.bySlug;
  if (!balancesBySlug || !global.tokenInfo || !global.swapTokenInfo) {
    return undefined;
  }

  const accountSettings = selectCurrentAccountSettings(global) ?? {};
  const { areTokensWithNoCostHidden, isSortByValueEnabled } = global.settings;

  return selectAccountTokensForSwapMemoizedFor(global.currentAccountId!)(
    balancesBySlug,
    global.tokenInfo,
    global.swapTokenInfo,
    accountSettings,
    isSortByValueEnabled,
    areTokensWithNoCostHidden,
  );
}

export function selectPopularTokens(global: GlobalState) {
  const balancesBySlug = selectCurrentAccountState(global)?.balances?.bySlug;
  if (!balancesBySlug || !global.swapTokenInfo) {
    return undefined;
  }

  return selectPopularTokensMemoizedFor(global.currentAccountId!)(balancesBySlug, global.swapTokenInfo);
}

export function selectSwapTokens(global: GlobalState) {
  const balancesBySlug = selectCurrentAccountState(global)?.balances?.bySlug;
  if (!balancesBySlug || !global.swapTokenInfo) {
    return undefined;
  }

  return selectSwapTokensMemoizedFor(global.currentAccountId!)(
    balancesBySlug,
    global.swapTokenInfo,
  );
}

export function selectCurrentSwapTokenIn(global: GlobalState) {
  const { tokenInSlug } = global.currentSwap;
  return tokenInSlug === undefined ? undefined : global.swapTokenInfo.bySlug[tokenInSlug];
}

export function selectCurrentSwapTokenOut(global: GlobalState) {
  const { tokenOutSlug } = global.currentSwap;
  return tokenOutSlug === undefined ? undefined : global.swapTokenInfo.bySlug[tokenOutSlug];
}

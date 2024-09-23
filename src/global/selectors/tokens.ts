// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { ApiBalanceBySlug, ApiChain, ApiSwapAsset } from '../../api/types';
import type {
  AccountSettings, GlobalState, UserSwapToken, UserToken,
} from '../types';

import {
  CHAIN_CONFIG,
  ENABLED_TOKEN_SLUGS,
  MYCOIN_SLUG,
  MYCOIN_SLUG_TESTNET,
  PRIORITY_TOKEN_SLUGS,
  TINY_TRANSFER_MAX_COST,
  TONCOIN,
} from '../../config';
import { toBig } from '../../util/decimals';
import memoize from '../../util/memoize';
import { round } from '../../util/round';
import withCache from '../../util/withCache';
import {
  selectAccountSettings,
  selectAccountState,
  selectCurrentAccountSettings,
  selectCurrentAccountState,
} from './accounts';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const selectAccountTokensMemoizedFor = withCache((accountId: string) => memoize((
  balancesBySlug: ApiBalanceBySlug,
  tokenInfo: GlobalState['tokenInfo'],
  accountSettings: AccountSettings,
  isSortByValueEnabled: boolean = false,
  areTokensWithNoCostHidden: boolean = false,
) => {
  return Object
    .entries(balancesBySlug)
    .filter(([slug]) => (slug in tokenInfo.bySlug && !accountSettings.deletedSlugs?.includes(slug)))
    .map(([slug, balance]) => {
      const {
        symbol, name, image, decimals, cmcSlug, color, chain, tokenAddress, quote: {
          price, percentChange24h, priceUsd,
        },
      } = tokenInfo.bySlug[slug];

      const balanceBig = toBig(balance, decimals);
      const totalValue = balanceBig.mul(price).round(decimals).toString();
      const hasCost = balanceBig.mul(priceUsd ?? 0).gte(TINY_TRANSFER_MAX_COST);
      const isExcepted = accountSettings.exceptionSlugs?.includes(slug);
      const isMycoinWithBalance = slug === MYCOIN_SLUG && balance;
      const isDisabled = !(
        ENABLED_TOKEN_SLUGS.includes(slug)
        || (areTokensWithNoCostHidden && hasCost && !isExcepted)
        || (areTokensWithNoCostHidden && !hasCost && !isMycoinWithBalance && isExcepted)
        || (areTokensWithNoCostHidden && !hasCost && isMycoinWithBalance && !isExcepted)
        || (!areTokensWithNoCostHidden && !isExcepted)
      );

      return {
        chain,
        symbol,
        slug,
        amount: balance,
        name,
        image,
        price,
        priceUsd,
        decimals,
        change24h: round(percentChange24h / 100, 4),
        isDisabled,
        cmcSlug,
        totalValue,
        color,
        tokenAddress,
      } as UserToken;
    })
    .sort((tokenA, tokenB) => {
      if (isSortByValueEnabled) {
        const priorityA = PRIORITY_TOKEN_SLUGS.indexOf(tokenA.slug);
        const priorityB = PRIORITY_TOKEN_SLUGS.indexOf(tokenB.slug);

        // If both tokens are prioritized and their balances match
        if (priorityA !== -1 && priorityB !== -1 && tokenA.totalValue === tokenB.totalValue) {
          return priorityA - priorityB;
        }

        // If one token is prioritized and the other is not
        if (priorityA !== -1 && priorityB === -1) return -1;
        if (priorityB !== -1 && priorityA === -1) return 1;

        return Number(tokenB.totalValue) - Number(tokenA.totalValue);
      }

      if (!accountSettings.orderedSlugs) {
        return 1;
      }

      const indexA = accountSettings.orderedSlugs.indexOf(tokenA.slug);
      const indexB = accountSettings.orderedSlugs.indexOf(tokenB.slug);
      return indexA - indexB;
    });
}));

export function selectCurrentAccountTokens(global: GlobalState) {
  return selectAccountTokens(global, global.currentAccountId!);
}

export function selectCurrentAccountTokenBalance(global: GlobalState, slug: string) {
  return selectCurrentAccountState(global)?.balances?.bySlug[slug] ?? 0n;
}

export function selectCurrentToncoinBalance(global: GlobalState) {
  return selectCurrentAccountTokenBalance(global, TONCOIN.slug);
}

export function selectAccountTokens(global: GlobalState, accountId: string) {
  const balancesBySlug = selectAccountState(global, accountId)?.balances?.bySlug;
  if (!balancesBySlug || !global.tokenInfo) {
    return undefined;
  }

  const accountSettings = selectAccountSettings(global, accountId) ?? {};
  const { areTokensWithNoCostHidden, isSortByValueEnabled } = global.settings;

  return selectAccountTokensMemoizedFor(accountId)(
    balancesBySlug,
    global.tokenInfo,
    accountSettings,
    isSortByValueEnabled,
    areTokensWithNoCostHidden,
  );
}

export function selectAccountTokenBySlug(global: GlobalState, slug: string) {
  const accountTokens = selectCurrentAccountTokens(global);
  return accountTokens?.find((token) => token.slug === slug);
}

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
        chain: chain in CHAIN_CONFIG ? chain as ApiChain : 'ton',
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

export function selectTokenAddress(global: GlobalState, slug: string) {
  if (slug === TONCOIN.slug) return undefined;
  return selectToken(global, slug).tokenAddress!;
}

export function selectToken(global: GlobalState, slug: string) {
  return Object.values(global.tokenInfo.bySlug)
    .find((token) => slug === token.slug)!;
}

export function selectMycoin(global: GlobalState) {
  const { isTestnet } = global.settings;

  return global.tokenInfo.bySlug[isTestnet ? MYCOIN_SLUG_TESTNET : MYCOIN_SLUG];
}

export function selectTokenByMinterAddress(global: GlobalState, minter: string) {
  return Object.values(global.tokenInfo.bySlug).find((token) => token.tokenAddress === minter);
}

import type {
  ApiBalanceBySlug, ApiNetwork, ApiSwapAsset, ApiTxIdBySlug,
} from '../../api/types';
import type {
  Account,
  AccountSettings,
  AccountState,
  GlobalState,
  StakingStatus,
  UserSwapToken,
  UserToken,
} from '../types';

import { MYCOIN_SLUG, MYCOIN_SLUG_TESTNET, TONCOIN_SLUG } from '../../config';
import { parseAccountId } from '../../util/account';
import { toBig } from '../../util/decimals';
import { findLast, mapValues } from '../../util/iteratees';
import memoized from '../../util/memoized';
import { round } from '../../util/round';
import { getIsSwapId, getIsTxIdLocal } from '../helpers';

const HIDDEN_TOKENS_COST = 0.01;

export function selectHasSession(global: GlobalState) {
  return Boolean(global.currentAccountId);
}

const selectAccountTokensMemoized = memoized((
  balancesBySlug: ApiBalanceBySlug,
  tokenInfo: GlobalState['tokenInfo'],
  accountSettings: AccountSettings,
  isSortByValueEnabled: boolean = false,
  areTokensWithNoCostHidden: boolean = false,
) => {
  return Object
    .entries(balancesBySlug)
    .filter(([slug]) => (slug in tokenInfo.bySlug))
    .map(([slug, balance]) => {
      const {
        symbol, name, image, decimals, cmcSlug, color, quote: {
          price, percentChange24h, priceUsd,
        },
      } = tokenInfo.bySlug[slug];

      const balanceBig = toBig(balance, decimals);
      const totalValue = balanceBig.mul(price).round(decimals).toString();
      const hasCost = balanceBig.mul(priceUsd ?? 0).gte(HIDDEN_TOKENS_COST);
      const isExcepted = accountSettings.exceptionSlugs?.includes(slug);
      const isMycoinWithBalance = slug === MYCOIN_SLUG && balance;
      const isDisabled = !(
        slug === TONCOIN_SLUG
        || (areTokensWithNoCostHidden && hasCost && !isExcepted)
        || (areTokensWithNoCostHidden && !hasCost && !isMycoinWithBalance && isExcepted)
        || (areTokensWithNoCostHidden && !hasCost && isMycoinWithBalance && !isExcepted)
        || (!areTokensWithNoCostHidden && !isExcepted)
      );

      return {
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
      } as UserToken;
    })
    .sort((tokenA, tokenB) => {
      if (isSortByValueEnabled) {
        return Number(tokenB.totalValue) - Number(tokenA.totalValue);
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
  return selectAccountTokens(global, global.currentAccountId!);
}

export function selectCurrentToncoinBalance(global: GlobalState) {
  return selectCurrentAccountState(global)?.balances?.bySlug[TONCOIN_SLUG] ?? 0n;
}

export function selectAccountTokens(global: GlobalState, accountId: string) {
  const balancesBySlug = selectAccountState(global, accountId)?.balances?.bySlug;
  if (!balancesBySlug || !global.tokenInfo) {
    return undefined;
  }

  const accountSettings = selectAccountSettings(global, accountId) ?? {};
  const { areTokensWithNoCostHidden, isSortByValueEnabled } = global.settings;

  return selectAccountTokensMemoized(
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
      decimals, keywords, blockchain,
      contract, isPopular, color, price = 0, priceUsd = 0,
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
        blockchain,
        contract,
        totalValue,
        color,
      } satisfies UserSwapToken;
    })
    .sort(sortFn);
}

const selectPopularTokensMemoized = memoized(
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
);

const selectSwapTokensMemoized = memoized(
  (balancesBySlug: ApiBalanceBySlug, swapTokenInfo: GlobalState['swapTokenInfo']) => {
    const sortFn = (tokenA: ApiSwapAsset, tokenB: ApiSwapAsset) => (
      tokenA.name.trim().toLowerCase().localeCompare(tokenB.name.trim().toLowerCase())
    );
    return createTokenList(swapTokenInfo, balancesBySlug, sortFn);
  },
);

const selectAccountTokensForSwapMemoized = memoized((
  balancesBySlug: ApiBalanceBySlug,
  tokenInfo: GlobalState['tokenInfo'],
  swapTokenInfo: GlobalState['swapTokenInfo'],
  accountSettings: AccountSettings,
  isSortByValueEnabled = false,
  areTokensWithNoCostHidden = false,
) => {
  return selectAccountTokensMemoized(
    balancesBySlug,
    tokenInfo,
    accountSettings,
    isSortByValueEnabled,
    areTokensWithNoCostHidden,
  ).filter((token) => token.slug in swapTokenInfo.bySlug && !token.isDisabled);
});

export function selectAvailableUserForSwapTokens(global: GlobalState) {
  const balancesBySlug = selectCurrentAccountState(global)?.balances?.bySlug;
  if (!balancesBySlug || !global.tokenInfo || !global.swapTokenInfo) {
    return undefined;
  }

  const accountSettings = selectAccountSettings(global, global.currentAccountId!) ?? {};
  const { areTokensWithNoCostHidden, isSortByValueEnabled } = global.settings;

  return selectAccountTokensForSwapMemoized(
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

  return tokens?.length === 0 || (tokens?.length === 1 && tokens[0].amount === 0n);
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

export function selectAccountIdByAddress(global: GlobalState, address: string): string | undefined {
  const accounts = selectAccounts(global);

  if (!accounts) return undefined;

  const requiredAccount = Object.entries(accounts)
    .find(([accountId, account]) => (account.address === address ? accountId : undefined));

  return requiredAccount?.[0];
}

export function selectTokenAddress(global: GlobalState, slug: string) {
  if (slug === TONCOIN_SLUG) return undefined;
  return Object.values(global.tokenInfo.bySlug)
    .find((token) => slug === token.slug)!
    .minterAddress!;
}

export function selectCurrentAccountStakingStatus(global: GlobalState): StakingStatus | undefined {
  const accountState = selectCurrentAccountState(global);

  return accountState?.staking?.balance
    ? accountState.staking.isUnstakeRequested
      ? 'unstakeRequested'
      : 'active'
    : undefined;
}

// Slow, not to be used in `withGlobal`
export function selectVestingPartsReadyToUnfreeze(global: GlobalState, accountId: string) {
  const vesting = selectAccountState(global, accountId)?.vesting?.info || [];

  return vesting.reduce((acc, currentVesting) => {
    currentVesting.parts.forEach((part) => {
      if (part.status === 'ready') {
        acc.push({
          id: currentVesting.id,
          partId: part.id,
        });
      }
    });

    return acc;
  }, [] as { id: number; partId: number }[]);
}

export function selectMycoin(global: GlobalState) {
  const { isTestnet } = global.settings;

  return global.tokenInfo.bySlug[isTestnet ? MYCOIN_SLUG_TESTNET : MYCOIN_SLUG];
}

export function selectTokenByMinterAddress(global: GlobalState, minter: string) {
  return Object.values(global.tokenInfo.bySlug).find((token) => token.minterAddress === minter);
}

export function selectCurrentAccountNftByAddress(global: GlobalState, nftAddress: string) {
  return selectAccountNftByAddress(global, global.currentAccountId!, nftAddress);
}

export function selectAccountNftByAddress(global: GlobalState, accountId: string, nftAddress: string) {
  return selectAccountState(global, accountId)?.nfts?.byAddress[nftAddress];
}

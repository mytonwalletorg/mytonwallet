import type { ApiNetwork, ApiTxIdBySlug } from '../../api/types';
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
  isSortByValueEnabled = false,
  areTokensWithNoBalanceHidden = false,
  areTokensWithNoPriceHidden = false,
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

export const selectPopularTokensMemoized = memoized((
  balancesBySlug: Record<string, string>,
  tokenInfo: GlobalState['tokenInfo'],
) => {
  return Object.entries(tokenInfo.bySlug)
    .filter(([slug, token]) => token.isPopular && !(slug in balancesBySlug))
    .map(([slug]) => {
      const {
        symbol, name, image, decimals, keywords, quote: {
          price, percentChange24h, percentChange7d, percentChange30d, history7d, history24h, history30d,
        },
      } = tokenInfo.bySlug[slug];
      const amount = bigStrToHuman('0', decimals);

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
        keywords,
      } as UserToken;
    });
});

export function selectPopularTokensWithoutAccountTokens(global: GlobalState) {
  const balancesBySlug = selectCurrentAccountState(global)?.balances?.bySlug;
  if (!balancesBySlug || !global.tokenInfo) {
    return undefined;
  }

  return selectPopularTokensMemoized(balancesBySlug, global.tokenInfo);
}

const selectSwapTokensMemoized = memoized((
  balancesBySlug: Record<string, string>,
  swapTokenInfo: GlobalState['swapTokenInfo'],
) => {
  const tokenList: UserSwapToken[] = Object.entries(swapTokenInfo.bySlug)
    .map(([slug]) => {
      const {
        symbol, name, image, decimals, keywords, blockchain, contract,
      } = swapTokenInfo.bySlug[slug];
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
        keywords,
        blockchain,
        contract,
      } satisfies UserSwapToken;
    });

  const userTokenList = tokenList.slice()
    .sort((a, b) => a.name.trim().toLowerCase().localeCompare(b.name.trim().toLowerCase()));

  return userTokenList;
});

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

export function selectIsOneAccount(global: GlobalState) {
  return Object.keys(selectAccounts(global) || {}).length === 1;
}

export const selectEnabledTokensCountMemoized = memoized((tokens?: UserToken[]) => {
  return (tokens ?? []).filter(({ isDisabled }) => !isDisabled).length;
});

export function selectLastLedgerAccountIndex(global: GlobalState, network: ApiNetwork) {
  const byId = global.accounts?.byId ?? {};
  return Object.entries(byId).reduce((previousValue, [accountId, account]) => {
    if (!account.ledger || parseAccountId(accountId).network !== network) {
      return previousValue;
    }
    return Math.max(account.ledger.index, previousValue ?? 0);
  }, undefined as number | undefined);
}

export function selectLocalTransactions(global: GlobalState, accountId: string) {
  const accountState = global.byAccountId?.[accountId];

  return accountState?.activities?.localTransactions;
}

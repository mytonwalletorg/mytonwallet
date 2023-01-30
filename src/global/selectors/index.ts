import {
  Account, AccountState, GlobalState, UserToken,
} from '../types';

import memoized from '../../util/memoized';
import { bigStrToHuman } from '../helpers';
import { round } from '../../util/round';
import { parseAccountId } from '../../util/account';
import { ApiNetwork } from '../../api/types';

export function selectHasSession(global: GlobalState) {
  return Boolean(global.currentAccountId);
}

export const selectAccountTokensMemoized = memoized((
  balancesBySlug: Record<string, string>,
  tokenInfo: Exclude<GlobalState['tokenInfo'], undefined>,
) => {
  return Object
    .entries(balancesBySlug)
    .filter(([slug]) => (slug in tokenInfo.bySlug))
    .map(([slug, balance]) => {
      const {
        symbol, name, image, decimals, quote: {
          price, percentChange24h, percentChange7d, percentChange30d, history7d, history24h, history30d,
        },
      } = tokenInfo.bySlug[slug];
      const amount = bigStrToHuman(balance, decimals);

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
      } as UserToken;
    });
});

export function selectCurrentAccountTokens(global: GlobalState) {
  const balancesBySlug = selectCurrentAccountState(global)?.balances?.bySlug;
  if (!balancesBySlug || !global.tokenInfo) {
    return undefined;
  }

  return selectAccountTokensMemoized(balancesBySlug, global.tokenInfo);
}

export function selectAccounts(global: GlobalState) {
  return global.accounts?.byId;
}

export const selectNetworkAccountsMemoized = memoized((
  network: ApiNetwork,
  accountsById?: Record<string, Account>,
) => {
  if (!accountsById) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(accountsById)
      .filter(([accountId]) => parseAccountId(accountId).network === network),
  );
});

export function selectNetworkAccounts(global: GlobalState) {
  return selectNetworkAccountsMemoized(selectCurrentNetwork(global), global.accounts?.byId);
}

export function selectCurrentNetwork(global: GlobalState) {
  return global.settings.isTestnet ? 'testnet' : 'mainnet';
}

export function selectAccount(global: GlobalState, accountId: string) {
  return selectAccounts(global)?.[accountId];
}

export function selectCurrentAccountState(global: GlobalState): AccountState | undefined {
  return selectAccountState(global, global.currentAccountId!);
}

export function selectAccountState(global: GlobalState, accountId: string): AccountState | undefined {
  return global.byAccountId[accountId];
}

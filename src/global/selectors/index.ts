import type { ApiNetwork, ApiTxIdBySlug } from '../../api/types';
import type { Account, GlobalState, UserToken } from '../types';

import { DEFAULT_LANDSCAPE_ACTION_TAB_ID } from '../../config';
import { parseAccountId } from '../../util/account';
import { findLast, mapValues } from '../../util/iteratees';
import memoized from '../../util/memoized';
import { round } from '../../util/round';
import { bigStrToHuman, getIsTxIdLocal } from '../helpers';

export function selectHasSession(global: GlobalState) {
  return Boolean(global.currentAccountId);
}

export const selectAccountTokensMemoized = memoized(
  (balancesBySlug: Record<string, string>, tokenInfo: Exclude<GlobalState['tokenInfo'], undefined>) => {
    return Object.entries(balancesBySlug)
      .filter(([slug]) => slug in tokenInfo.bySlug)
      .map(([slug, balance]) => {
        const {
          symbol,
          name,
          image,
          decimals,
          quote: {
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
  },
);

export function selectCurrentAccountTokens(global: GlobalState) {
  const balancesBySlug = selectCurrentAccountState(global)?.balances?.bySlug;
  if (!balancesBySlug || !global.tokenInfo) {
    return undefined;
  }

  return selectAccountTokensMemoized(balancesBySlug, global.tokenInfo);
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

export function selectAccount(global: GlobalState, accountId: string) {
  return selectAccounts(global)?.[accountId];
}

export function selectCurrentAccountState(global: GlobalState) {
  return selectAccountState(global, global.currentAccountId!);
}

export function selectAccountState(global: GlobalState, accountId: string) {
  return global.byAccountId[accountId];
}

export function selectLandscapeActionsActiveTabIndex(global: GlobalState) {
  return global.landscapeActionsActiveTabIndex ?? DEFAULT_LANDSCAPE_ACTION_TAB_ID;
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
    selectAccountState(global, accountId)?.transactions?.newestTransactionsBySlug || {},
    ({ txId }) => txId,
  );
}

export function selectLastTxIds(global: GlobalState, accountId: string): ApiTxIdBySlug {
  const txIdsBySlug = selectAccountState(global, accountId)?.transactions?.txIdsBySlug || {};

  return mapValues(txIdsBySlug, (tokenTxIds) => {
    return findLast(tokenTxIds, (txId) => !getIsTxIdLocal(txId));
  });
}

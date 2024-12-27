import type { ApiChain, ApiNetwork } from '../../api/types';
import type {
  Account, AccountSettings, AccountState, GlobalState, UserToken,
} from '../types';

import { parseAccountId } from '../../util/account';
import memoize from '../../util/memoize';
import withCache from '../../util/withCache';

export function selectIsNewWallet(global: GlobalState, isFirstTransactionsLoaded: boolean) {
  const { activities } = selectCurrentAccountState(global) ?? {};

  if (activities?.idsMain?.length) {
    return false;
  }

  return isFirstTransactionsLoaded;
}

export function selectAccounts(global: GlobalState) {
  return global.accounts?.byId;
}

export const selectNetworkAccountsMemoized = memoize((network: ApiNetwork, accountsById?: Record<string, Account>) => {
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

export function selectAccountSettings(global: GlobalState, accountId: string): AccountSettings | undefined {
  return global.settings.byAccountId[accountId];
}

export function selectCurrentAccountSettings(global: GlobalState) {
  return selectAccountSettings(global, global.currentAccountId!);
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const selectEnabledTokensCountMemoizedFor = withCache((accountId: string) => memoize((tokens?: UserToken[]) => {
  return (tokens ?? []).filter(({ isDisabled }) => !isDisabled).length;
}));

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

export function selectIsPasswordPresent(global: GlobalState) {
  return !!selectFirstNonHardwareAccount(global);
}

export function selectAccountIdByAddress(
  global: GlobalState,
  chain: ApiChain,
  address: string,
): string | undefined {
  const accounts = selectAccounts(global);

  if (!accounts) return undefined;

  const requiredAccount = Object.entries(accounts)
    .find(([accountId, account]) => (account.addressByChain[chain] === address ? accountId : undefined));

  return requiredAccount?.[0];
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

export function selectCurrentAccountNftByAddress(global: GlobalState, nftAddress: string) {
  return selectAccountNftByAddress(global, global.currentAccountId!, nftAddress);
}

export function selectAccountNftByAddress(global: GlobalState, accountId: string, nftAddress: string) {
  return selectAccountState(global, accountId)?.nfts?.byAddress[nftAddress];
}

export function selectIsMultichainAccount(global: GlobalState, accountId: string) {
  return Boolean(selectAccount(global, accountId)?.addressByChain.tron);
}

export function selectHasSession(global: GlobalState) {
  return Boolean(global.currentAccountId);
}

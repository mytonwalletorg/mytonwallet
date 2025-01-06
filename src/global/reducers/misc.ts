import type {
  ApiBalanceBySlug,
  ApiChain,
  ApiSwapAsset,
  ApiTokenWithPrice,
} from '../../api/types';
import type { Account, AccountState, GlobalState } from '../types';

import { POPULAR_WALLET_VERSIONS, TON_USDT_SLUG, TONCOIN } from '../../config';
import isPartialDeepEqual from '../../util/isPartialDeepEqual';
import { getChainBySlug } from '../../util/tokens';
import {
  selectAccount,
  selectAccountSettings,
  selectAccountState,
  selectCurrentNetwork,
  selectNetworkAccounts,
} from '../selectors';

export function updateAuth(global: GlobalState, authUpdate: Partial<GlobalState['auth']>) {
  return {
    ...global,
    auth: {
      ...global.auth,
      ...authUpdate,
    },
  } as GlobalState;
}

export function updateAccounts(
  global: GlobalState,
  state: Partial<GlobalState['accounts']>,
) {
  return {
    ...global,
    accounts: {
      ...(global.accounts || { byId: {} }),
      ...state,
    },
  };
}

export function setIsPinAccepted(global: GlobalState): GlobalState {
  return {
    ...global,
    isPinAccepted: true,
  };
}

export function clearIsPinAccepted(global: GlobalState): GlobalState {
  return {
    ...global,
    isPinAccepted: undefined,
  };
}

export function createAccount(
  global: GlobalState,
  accountId: string,
  addressByChain: Record<ApiChain, string>,
  partial?: Partial<Account>,
  titlePostfix?: string,
) {
  let shouldForceAccountEdit = true;

  if (!partial?.title) {
    const network = selectCurrentNetwork(global);
    const accounts = selectNetworkAccounts(global) || {};
    const accountAmount = Object.keys(accounts).length;
    const isMainnet = network === 'mainnet';
    const titlePrefix = isMainnet ? 'Wallet' : 'Testnet Wallet';
    const postfix = titlePostfix ? ` ${titlePostfix}` : '';
    let title = `${titlePrefix} ${accountAmount + 1}${postfix}`;

    if (accountAmount === 0) {
      title = isMainnet ? 'MyTonWallet' : 'Testnet MyTonWallet';
      shouldForceAccountEdit = false;
    }

    partial = { ...partial, title };
  } else if (titlePostfix) {
    const title = partial.title?.replace(new RegExp(`\\b(${POPULAR_WALLET_VERSIONS.join('|')})\\b`, 'g'), '');
    partial = { ...partial, title: `${title.trim()} ${titlePostfix}` };
  }

  global = { ...global, shouldForceAccountEdit };

  return updateAccount(global, accountId, { ...partial, addressByChain });
}

export function updateAccount(
  global: GlobalState,
  accountId: string,
  partial: Partial<Account>,
) {
  return {
    ...global,
    accounts: {
      ...global.accounts,
      byId: {
        ...global.accounts?.byId,
        [accountId]: {
          ...selectAccount(global, accountId),
          ...partial,
        } as Account,
      },
    },
  };
}

export function renameAccount(global: GlobalState, accountId: string, title: string) {
  return updateAccount(global, accountId, { title });
}

export function updateBalances(
  global: GlobalState,
  accountId: string,
  chain: ApiChain,
  chainBalances: ApiBalanceBySlug,
): GlobalState {
  const balances: ApiBalanceBySlug = { ...chainBalances };
  const currentBalances = selectAccountState(global, accountId)?.balances?.bySlug ?? {};
  const importedSlugs = selectAccountSettings(global, accountId)?.importedSlugs ?? [];

  for (const [slug, balance] of Object.entries(currentBalances)) {
    if (getChainBySlug(slug) !== chain) {
      balances[slug] = balance;
    }
  }

  // Force balance value for USDT-TON and manual imported tokens
  for (const slug of [...importedSlugs, TON_USDT_SLUG]) {
    if (!(slug in balances)) {
      balances[slug] = 0n;
    }
  }

  return updateAccountState(global, accountId, {
    balances: {
      bySlug: balances,
    },
  });
}

export function changeBalance(global: GlobalState, accountId: string, slug: string, balance: bigint) {
  return updateAccountState(global, accountId, {
    balances: {
      bySlug: {
        ...selectAccountState(global, accountId)?.balances?.bySlug,
        [slug]: balance,
      },
    },
  });
}

export function updateTokens(
  global: GlobalState,
  partial: Record<string, ApiTokenWithPrice>,
  withDeepCompare = false,
): GlobalState {
  const currentTokens = global.tokenInfo?.bySlug;

  // If the backend does not work, then we won't delete the old prices
  if (!partial[TONCOIN.slug].quote.price) {
    partial = Object.values(partial).reduce((result, token) => {
      result[token.slug] = {
        ...token,
        quote: currentTokens?.[token.slug]?.quote ?? token.quote,
      };
      return result;
    }, {} as Record<string, ApiTokenWithPrice>);
  }

  if (withDeepCompare && currentTokens && isPartialDeepEqual(currentTokens, partial)) {
    return global;
  }

  return {
    ...global,
    tokenInfo: {
      ...global.tokenInfo,
      bySlug: {
        ...currentTokens,
        ...partial,
      },
    },
  };
}

export function updateSwapTokens(
  global: GlobalState,
  partial: Record<string, ApiSwapAsset>,
): GlobalState {
  const currentTokens = global.swapTokenInfo?.bySlug;

  return {
    ...global,
    swapTokenInfo: {
      ...global.swapTokenInfo,
      bySlug: {
        ...currentTokens,
        ...partial,
      },
    },
  };
}

export function updateCurrentAccountState(global: GlobalState, partial: Partial<AccountState>): GlobalState {
  return updateAccountState(global, global.currentAccountId!, partial);
}

export function updateAccountState(
  global: GlobalState, accountId: string, partial: Partial<AccountState>, withDeepCompare = false,
): GlobalState {
  const accountState = selectAccountState(global, accountId);

  if (withDeepCompare && accountState && isPartialDeepEqual(accountState, partial)) {
    return global;
  }

  return {
    ...global,
    byAccountId: {
      ...global.byAccountId,
      [accountId]: {
        ...accountState,
        ...partial,
      },
    },
  };
}

export function updateHardware(global: GlobalState, hardwareUpdate: Partial<GlobalState['hardware']>) {
  return {
    ...global,
    hardware: {
      ...global.hardware,
      ...hardwareUpdate,
    },
  } as GlobalState;
}

export function updateSettings(global: GlobalState, settingsUpdate: Partial<GlobalState['settings']>) {
  return {
    ...global,
    settings: {
      ...global.settings,
      ...settingsUpdate,
    },
  } as GlobalState;
}

export function updateAccountSettings(
  global: GlobalState,
  accountId: string,
  settingsUpdate: Partial<GlobalState['settings']['byAccountId']['*']>,
) {
  return {
    ...global,
    settings: {
      ...global.settings,
      byAccountId: {
        ...global.settings.byAccountId,
        [accountId]: {
          ...global.settings.byAccountId[accountId],
          ...settingsUpdate,
        },
      },
    },
  } as GlobalState;
}

export function updateCurrentAccountSettings(
  global: GlobalState,
  settingsUpdate: Partial<GlobalState['settings']['byAccountId']['*']>,
) {
  return updateAccountSettings(global, global.currentAccountId!, settingsUpdate);
}

export function updateBiometrics(global: GlobalState, biometricsUpdate: Partial<GlobalState['biometrics']>) {
  return {
    ...global,
    biometrics: {
      ...global.biometrics,
      ...biometricsUpdate,
    },
  };
}

export function updateRestrictions(global: GlobalState, partial: Partial<GlobalState['restrictions']>) {
  return {
    ...global,
    restrictions: {
      ...global.restrictions,
      ...partial,
    },
  };
}

export function updateCurrentAccountId(global: GlobalState, accountId: string): GlobalState {
  if (!accountId) {
    throw Error('Empty accountId!');
  }

  return {
    ...global,
    currentAccountId: accountId,
  };
}

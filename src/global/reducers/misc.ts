import { GlobalState } from '../types';
import { ApiToken, ApiTransaction } from '../../api/types';

export function updateAuth(global: GlobalState, authUpdate: Partial<GlobalState['auth']>) {
  return {
    ...global,
    auth: {
      ...global.auth,
      ...authUpdate,
    },
  };
}

export function updateAddress(global: GlobalState, accountId: string, address: string) {
  return {
    ...global,
    addresses: {
      ...global.addresses,
      byAccountId: {
        ...(global.addresses?.byAccountId || {}),
        [accountId]: address,
      },
    },
  };
}

export function updateBalance(
  global: GlobalState, accountId: string, slug: string, balance: string,
): GlobalState | undefined {
  if (global.balances?.byAccountId[accountId]?.bySlug[slug] === balance) {
    return undefined;
  }

  return {
    ...global,
    balances: {
      byAccountId: {
        ...global.balances?.byAccountId || {},
        [accountId]: {
          bySlug: {
            ...global.balances?.byAccountId[accountId]?.bySlug || {},
            [slug]: balance,
          },
        },
      },
    },
  };
}

export function updateSendingLoading(global: GlobalState, isLoading: boolean): GlobalState {
  return {
    ...global,
    currentTransfer: {
      ...global.currentTransfer,
      isLoading,
    },
  };
}

export function updateTokens(global: GlobalState, tokens: Record<string, ApiToken>): GlobalState {
  return {
    ...global,
    tokenInfo: {
      ...global.tokenInfo,
      bySlug: {
        ...(global.tokenInfo && global.tokenInfo.bySlug),
        ...tokens,
      },
    },
  };
}

export function updateTransaction(global: GlobalState, transaction: ApiTransaction): GlobalState {
  return {
    ...global,
    transactions: {
      ...global.transactions,
      byTxId: { ...(global.transactions?.byTxId || {}), [transaction.txId]: transaction },
      orderedTxIds: (global.transactions?.orderedTxIds || []).includes(transaction.txId)
        ? global.transactions?.orderedTxIds
        : [transaction.txId].concat(global.transactions?.orderedTxIds || []),
    },
  };
}

export function updateLanguage(global: GlobalState, lang: string): GlobalState {
  return {
    ...global,
    currentLanguage: { lang },
  };
}

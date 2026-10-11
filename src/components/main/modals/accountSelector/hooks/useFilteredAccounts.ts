import { useMemo } from '../../../../../lib/teact/teact';

import type { Account, AccountType } from '../../../../../global/types';

import { AccountTab } from '../constants';

export function useFilteredAccounts(
  orderedAccounts: Array<[string, Account]> | undefined,
  activeTab: number,
) {
  return useMemo(() => {
    let allowedTypes: AccountType[];

    switch (activeTab as AccountTab) {
      case AccountTab.My:
        allowedTypes = ['mnemonic'];
        break;
      case AccountTab.View:
        allowedTypes = ['view'];
        break;
      case AccountTab.All:
      default:
        allowedTypes = ['mnemonic', 'view'];
        break;
    }

    return (orderedAccounts ?? []).filter(([_, account]) => allowedTypes.includes(account.type));
  }, [orderedAccounts, activeTab]);
}

import type { ApiChain } from '../../api/types';
import type { GlobalState } from '../types';

export interface NotificationAddress {
  title?: string;
  address: string;
  chain: ApiChain;
}

// Do not use with memorized React components
export function selectNotificationTonAddresses(
  global: GlobalState,
  accountIds: string[],
): NotificationAddress[] {
  return accountIds.map((accountId) => {
    const account = global.accounts!.byId[accountId];

    return {
      title: account.title,
      address: account.addressByChain.ton,
      chain: 'ton' as ApiChain,
    };
  });
}

import type { ApiChain, ApiNotificationAddress } from '../../api/types';
import type { GlobalState } from '../types';

// This selector is not optimized for usage with React components wrapped by withGlobal
export function selectNotificationTonAddressesSlow(
  global: GlobalState,
  accountIds: string[],
): ApiNotificationAddress[] {
  return accountIds.map((accountId) => {
    const account = global.accounts!.byId[accountId];

    return {
      title: account.title,
      address: account.addressByChain.ton,
      chain: 'ton' as ApiChain,
    };
  });
}

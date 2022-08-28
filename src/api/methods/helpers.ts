import { Storage } from '../storages/types';

export function resolveBlockchainKey(accountId: string) {
  if (accountId === '0') {
    return 'ton';
  }

  return undefined;
}

export async function checkAccountIsAuthorized(storage: Storage, accountId?: string) {
  const addressesJson = await storage.getItem('addresses');
  if (!addressesJson) {
    return false;
  }
  if (!accountId) {
    return true;
  }
  const accountIds = Object.keys(JSON.parse(addressesJson) as Record<string, string>);
  return accountIds.includes(accountId);
}

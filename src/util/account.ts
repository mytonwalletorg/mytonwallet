import type { AccountIdParsed, ApiNetwork } from '../api/types';

export function parseAccountId(accountId: string): AccountIdParsed {
  const parts = accountId.split('-');
  const [id, network = 'mainnet'] = (parts.length === 3 ? [parts[0], parts[2]] : parts) as [string, ApiNetwork];
  return { id: Number(id), network };
}

export function buildAccountId(account: AccountIdParsed) {
  const { id, network } = account;
  return `${id}-${network}`;
}

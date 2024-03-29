import type { AccountIdParsed, ApiBlockchainKey, ApiNetwork } from '../api/types';

export function parseAccountId(accountId: string): AccountIdParsed {
  const [
    id,
    blockchain = 'ton', // Handle deprecated case when `accountId = '0'`
    network = 'mainnet',
  ] = accountId.split('-');
  return {
    id: Number(id),
    blockchain: blockchain as ApiBlockchainKey,
    network: network as ApiNetwork,
  };
}

export function buildAccountId(account: AccountIdParsed) {
  const { id, network, blockchain } = account;
  return `${id}-${blockchain}-${network}`;
}

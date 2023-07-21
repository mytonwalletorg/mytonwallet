import blockchains from '../blockchains';
import { resolveBlockchainKey } from '../common/helpers';

export function fetchNfts(accountId: string) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  return blockchain.getAccountNfts(accountId);
}

import type { ApiNetwork } from '../types';

import { parseAccountId } from '../../util/account';
import chains from '../chains';

const { ton } = chains;

export { getTokenBySlug, buildTokenSlug } from '../common/tokens';

export function fetchToken(accountId: string, address: string) {
  const { network } = parseAccountId(accountId);
  return ton.fetchToken(network, address);
}

export function resolveTokenWalletAddress(network: ApiNetwork, address: string, tokenAddress: string) {
  const chain = chains.ton;

  return chain.resolveTokenWalletAddress(network, address, tokenAddress);
}

export function resolveTokenAddress(network: ApiNetwork, tokenWalletAddress: string) {
  const chain = chains.ton;

  return chain.resolveTokenAddress(network, tokenWalletAddress);
}

export function fetchTokenBalances(accountId: string) {
  const chain = chains.ton;

  return chain.getAccountTokenBalances(accountId);
}

export function fetchTokenBalancesByAddress(address: string, network: ApiNetwork) {
  const chain = chains.ton;

  return chain.getTokenBalances(network, address);
}

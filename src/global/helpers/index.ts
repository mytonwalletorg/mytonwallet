import type { ApiTokenWithPrice, ApiTransaction } from '../../api/types';

import { TINY_TRANSFER_MAX_COST, TRC20_USDT_MAINNET_SLUG, TRC20_USDT_TESTNET_SLUG } from '../../config';
import { toBig } from '../../util/decimals';

const TOKEN_SLUG_SUBSTITUTION: Record<string, string> = {
  [TRC20_USDT_MAINNET_SLUG]: 'usdtrx',
  [TRC20_USDT_TESTNET_SLUG]: 'usdtrx',
};

export function getIsTinyOrScamTransaction(transaction: ApiTransaction, token?: ApiTokenWithPrice) {
  if (transaction.metadata?.isScam) return true;
  if (!token || transaction.type === 'nftTransferred' || transaction.type === 'nftReceived') return false;

  const decimals = token.decimals;
  const cost = toBig(transaction.amount, decimals).abs().mul(token.quote.priceUsd ?? 0);
  return cost.lt(TINY_TRANSFER_MAX_COST);
}

export function getIsTxIdLocal(txId: string) {
  return txId.includes('|');
}

export function getRealTxIdFromLocal(txId: string) {
  return txId.endsWith('|') ? txId.replace('|', '') : undefined;
}

export function getIsSwapId(id: string) {
  return id.startsWith('swap:');
}

export function getTokenSlugForSwap(slug: string) {
  return TOKEN_SLUG_SUBSTITUTION[slug] || slug;
}

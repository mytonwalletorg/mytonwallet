import type { ApiToken, ApiTransaction } from '../../api/types';

import { TINY_TRANSFER_MAX_COST } from '../../config';
import { toBig } from '../../util/decimals';

export function getIsTinyOrScamTransaction(transaction: ApiTransaction, token?: ApiToken) {
  if (transaction.metadata?.isScam) return true;
  if (!token || transaction.type === 'nftTransferred' || transaction.type === 'nftReceived') return false;

  const decimals = token.decimals;
  const cost = toBig(transaction.amount, decimals).abs().mul(token.quote.priceUsd ?? 0);
  return cost.lt(TINY_TRANSFER_MAX_COST);
}

export function getIsTxIdLocal(txId: string) {
  return txId.includes('|');
}

export function getIsSwapId(id: string) {
  return id.startsWith('swap:');
}

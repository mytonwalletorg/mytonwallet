import type { ApiSwapAsset, ApiTokenWithPrice, ApiTransaction } from '../../api/types';

import { TINY_TRANSFER_MAX_COST, TONCOIN } from '../../config';
import { toBig } from '../../util/decimals';

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

export function resolveSwapAssetId(asset: ApiSwapAsset) {
  return asset.slug === TONCOIN.slug ? asset.symbol : (asset.tokenAddress ?? asset.slug);
}

export function resolveSwapAsset(bySlug: Record<string, ApiSwapAsset>, anyId: string) {
  return bySlug[anyId] ?? Object.values(bySlug).find(({ tokenAddress }) => tokenAddress === anyId);
}

export function getIsSupportedChain(chain?: string) {
  return chain === 'ton' || chain === 'tron';
}

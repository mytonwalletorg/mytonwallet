import type { ApiChain, ApiSwapAsset, ApiTokenWithPrice, ApiTransaction } from '../../api/types';
import type { Account, UserSwapToken } from '../types';

import { CHAIN_CONFIG, TINY_TRANSFER_MAX_COST, TONCOIN } from '../../config';
import { isScamTransaction } from '../../util/activities';
import { toBig } from '../../util/decimals';

export function getIsTinyOrScamTransaction(transaction: ApiTransaction, token?: ApiTokenWithPrice) {
  if (isScamTransaction(transaction)) return true;
  if (!token || transaction.nft || transaction.type) return false;

  const cost = toBig(transaction.amount, token.decimals).abs().mul(token.priceUsd ?? 0);
  return cost.lt(TINY_TRANSFER_MAX_COST);
}

export function resolveSwapAssetId(asset: ApiSwapAsset) {
  return asset.slug === TONCOIN.slug ? asset.symbol : (asset.tokenAddress ?? asset.slug);
}

export function resolveSwapAsset(bySlug: Record<string, ApiSwapAsset>, anyId: string) {
  return bySlug[anyId] ?? Object.values(bySlug).find(({ tokenAddress }) => tokenAddress === anyId);
}

export function getIsSupportedChain(chain?: string): chain is ApiChain {
  return chain as ApiChain in CHAIN_CONFIG;
}

export function getIsInternalSwap({
  from,
  to,
  toAddress,
  addressByChain,
}: {
  from?: UserSwapToken | ApiSwapAsset;
  to?: UserSwapToken | ApiSwapAsset;
  toAddress?: string;
  addressByChain?: Account['addressByChain'];
}) {
  const isMultichain = Boolean(addressByChain?.tron);
  return (from?.chain === 'ton' && to?.chain === 'ton') || (
    isMultichain && from && to && addressByChain
    && getIsSupportedChain(from.chain)
    && addressByChain[to.chain as ApiChain] === toAddress
  );
}

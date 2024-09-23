import type { SwapHistoryRange } from '../methods';
import type { ApiSwapActivity, ApiSwapHistoryItem } from '../types';

import { TONCOIN } from '../../config';
import { buildSwapId } from '../../util/swap/buildSwapId';
import { callBackendGet, callBackendPost } from './backend';
import { buildTokenSlug } from './tokens';

export function swapGetHistory(address: string, params: {
  fromLt?: number;
  toLt?: number;
  fromTimestamp?: number;
  toTimestamp?: number;
  status?: ApiSwapHistoryItem['status'];
  isCex?: boolean;
  asset?: string;
}): Promise<ApiSwapHistoryItem[]> {
  return callBackendGet(`/swap/history/${address}`, params);
}

export function swapGetHistoryByRanges(address: string, ranges: SwapHistoryRange[]): Promise<ApiSwapHistoryItem[]> {
  return callBackendPost(`/swap/history-ranges/${address}`, { ranges });
}

export function swapGetHistoryItem(address: string, id: string): Promise<ApiSwapHistoryItem> {
  return callBackendGet(`/swap/history/${address}/${id}`);
}

export function swapItemToActivity(swap: ApiSwapHistoryItem): ApiSwapActivity {
  return {
    ...swap,
    id: buildSwapId(swap.id),
    kind: 'swap',
    from: getSwapItemSlug(swap, swap.from),
    to: getSwapItemSlug(swap, swap.to),
  };
}

export function getSwapItemSlug(item: ApiSwapHistoryItem, asset: string) {
  if (asset === TONCOIN.symbol) return TONCOIN.slug;
  if (item.cex) return asset;
  return buildTokenSlug('ton', asset);
}

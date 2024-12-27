import type { SwapHistoryRange } from '../methods';
import type { ApiSwapActivity, ApiSwapHistoryItem } from '../types';

import { SWAP_API_VERSION, TONCOIN } from '../../config';
import { buildSwapId } from '../../util/swap/buildSwapId';
import { callBackendGet, callBackendPost } from './backend';
import { buildTokenSlug, getTokenByAddress } from './tokens';

export function swapGetHistory(address: string, params: {
  fromLt?: number;
  toLt?: number;
  fromTimestamp?: number;
  toTimestamp?: number;
  status?: ApiSwapHistoryItem['status'];
  isCex?: boolean;
  asset?: string;
}): Promise<ApiSwapHistoryItem[]> {
  return callBackendGet(`/swap/history/${address}`, {
    ...params,
    swapVersion: SWAP_API_VERSION,
  });
}

export function swapGetHistoryByRanges(address: string, ranges: SwapHistoryRange[]): Promise<ApiSwapHistoryItem[]> {
  return callBackendPost(`/swap/history-ranges/${address}`, {
    swapVersion: SWAP_API_VERSION,
    ranges,
  });
}

export function swapGetHistoryItem(address: string, id: string): Promise<ApiSwapHistoryItem> {
  return callBackendGet(`/swap/history/${address}/${id}`, {
    swapVersion: SWAP_API_VERSION,
  });
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
  if (asset === TONCOIN.symbol) {
    return TONCOIN.slug;
  }
  if (item.cex) {
    return getTokenByAddress(asset)?.slug ?? asset;
  }
  return buildTokenSlug('ton', asset);
}

export async function patchSwapItem(options: {
  address: string;
  swapId: string;
  authToken: string;
  msgHash?: string;
  error?: string;
}) {
  const {
    address, swapId, authToken, msgHash, error,
  } = options;
  await callBackendPost(`/swap/history/${address}/${swapId}/update`, {
    swapVersion: SWAP_API_VERSION,
    msgHash,
    error,
  }, {
    method: 'PATCH',
    authToken,
  });
}

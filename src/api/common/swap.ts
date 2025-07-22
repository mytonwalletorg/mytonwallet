import type { ApiActivity, ApiSwapActivity, ApiSwapHistoryItem } from '../types';

import { SWAP_API_VERSION, SWAP_CROSSCHAIN_SLUGS, TONCOIN } from '../../config';
import { parseAccountId } from '../../util/account';
import { buildBackendSwapId, getActivityTokenSlugs, parseTxId } from '../../util/activities';
import { compareActivities } from '../../util/compareActivities';
import { logDebugError } from '../../util/logs';
import { fetchStoredAccount } from './accounts';
import { callBackendGet, callBackendPost } from './backend';
import { buildTokenSlug, getTokenByAddress, getTokenBySlug } from './tokens';

export function swapGetHistory(address: string, params: {
  fromTimestamp?: number;
  toTimestamp?: number;
  status?: ApiSwapHistoryItem['status'];
  isCex?: boolean;
  asset?: string;
  hashes?: string[];
}): Promise<ApiSwapHistoryItem[]> {
  return callBackendPost(`/swap/history/${address}`, {
    ...params,
    swapVersion: SWAP_API_VERSION,
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
    id: buildBackendSwapId(swap.id),
    kind: 'swap',
    from: getSwapItemSlug(swap, swap.from),
    to: getSwapItemSlug(swap, swap.to),
    shouldLoadDetails: !swap.cex,
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

export async function swapReplaceCexActivities(
  accountId: string,
  activities: ApiActivity[],
  slug?: string,
  isToNow?: boolean,
): Promise<ApiActivity[]> {
  if (!activities.length || parseAccountId(accountId).network === 'testnet' || !canHaveCexSwap(slug, activities)) {
    return activities;
  }

  try {
    const { ton: { address } = {} } = await fetchStoredAccount(accountId);
    if (!address) {
      return activities;
    }

    const firstTimestamp = activities[0].timestamp;
    const lastTimestamp = activities[activities.length - 1].timestamp;

    const [fromTime, toTime] = firstTimestamp < lastTimestamp
      ? [firstTimestamp, isToNow ? Date.now() : lastTimestamp]
      : [lastTimestamp, isToNow ? Date.now() : firstTimestamp];

    const hashes = activities.map(({ id }) => parseTxId(id).hash);

    const swaps = await swapGetHistory(address, {
      fromTimestamp: fromTime,
      toTimestamp: toTime,
      asset: slug ? getTokenBySlug(slug).tokenAddress ?? TONCOIN.symbol : undefined,
      hashes,
      isCex: true,
    });

    if (!swaps.length) {
      return activities;
    }

    const result: ApiActivity[] = [];
    const allSwapHashes = new Set<string>();

    for (const swap of swaps) {
      swap.hashes.forEach((hash) => allSwapHashes.add(hash));

      const isSwapHere = swap.timestamp > fromTime && swap.timestamp < toTime;
      if (isSwapHere) {
        result.push(swapItemToActivity(swap));
      }
    }

    for (const activity of activities) {
      if (activity.kind === 'transaction' && allSwapHashes.has(parseTxId(activity.id).hash)) {
        result.push({ ...activity, shouldHide: true });
      } else {
        result.push(activity);
      }
    }

    result.sort(compareActivities);

    return result;
  } catch (err) {
    logDebugError('swapReplaceCexActivities', err);
    return activities;
  }
}

function canHaveCexSwap(slug: string | undefined, activities: ApiActivity[]): boolean {
  if (slug) {
    return SWAP_CROSSCHAIN_SLUGS.has(slug);
  }

  return activities.some((activity) => {
    return getActivityTokenSlugs(activity).some((slug) => {
      return SWAP_CROSSCHAIN_SLUGS.has(slug);
    });
  });
}

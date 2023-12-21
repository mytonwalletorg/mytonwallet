import type {
  ApiActivity,
  ApiSwapActivity,
  ApiSwapAsset,
  ApiSwapBuildRequest,
  ApiSwapBuildResponse,
  ApiSwapCexCreateTransactionRequest,
  ApiSwapCexCreateTransactionResponse,
  ApiSwapCexEstimateRequest,
  ApiSwapCexEstimateResponse,
  ApiSwapEstimateRequest,
  ApiSwapEstimateResponse,
  ApiSwapHistoryItem,
  ApiSwapPairAsset,
  ApiSwapTonAsset,
  ApiSwapTransfer,
  ApiTransactionActivity,
  OnApiUpdate,
} from '../types';

import { TON_SYMBOL, TON_TOKEN_SLUG } from '../../config';
import { logDebugError } from '../../util/logs';
import { pause } from '../../util/schedulers';
import { buildSwapId } from '../../util/swap/buildSwapId';
import blockchains from '../blockchains';
import { buildTokenSlug, parseTxId } from '../blockchains/ton/util';
import { fetchStoredAddress } from '../common/accounts';
import { callBackendGet, callBackendPost } from '../common/backend';
import { whenTxComplete } from '../common/txCallbacks';
import { callHook } from '../hooks';
import { getBackendAuthToken } from './other';

type LtRange = [number, number];

const SWAP_MAX_LT = 50;
const SWAP_WAITING_TIME = 5000; // 5 sec
const SWAP_WAITING_PAUSE = 500; // 0.5 sec

const pendingLtRanges: LtRange[] = [];
const ton = blockchains.ton;

let onUpdate: OnApiUpdate;

export function initSwap(_onUpdate: OnApiUpdate) {
  onUpdate = _onUpdate;
}

export async function swapBuildTransfer(accountId: string, password: string, params: ApiSwapBuildRequest) {
  const authToken = await getBackendAuthToken(accountId, password);

  const { id, transfers } = await swapBuild(authToken, params);

  const transferList = transfers.map((transfer) => ({
    ...transfer,
    isBase64Payload: true,
  }));
  const result = await ton.checkMultiTransactionDraft(accountId, transferList);

  if ('error' in result) {
    return result;
  }

  return { ...result, id, transfers };
}

export async function swapSubmit(
  accountId: string,
  password: string,
  fee: string,
  transfers: ApiSwapTransfer[],
  historyItem: ApiSwapHistoryItem,
) {
  const transferList = transfers.map((transfer) => ({
    ...transfer,
    isBase64Payload: true,
  }));
  const result = await ton.submitMultiTransfer(accountId, password, transferList);

  if ('error' in result) {
    return result;
  }

  const { amount, toAddress } = transfers[0];

  const from = getSwapItemSlug(historyItem, historyItem.from);
  const to = getSwapItemSlug(historyItem, historyItem.to);

  const swap: ApiSwapActivity = {
    ...historyItem,
    id: buildSwapId(historyItem.id),
    from,
    to,
    kind: 'swap',
  };

  function onTxComplete(transaction: ApiTransactionActivity) {
    const lt = parseTxId(transaction.txId).lt;
    pendingLtRanges.push([lt, lt + SWAP_MAX_LT]);
  }

  whenTxComplete(toAddress, amount)
    .then(({ transaction }) => onTxComplete(transaction));

  onUpdate({
    type: 'newActivities',
    accountId,
    activities: [swap],
  });

  void callHook('onSwapCreated', accountId, swap.timestamp - 1);

  return result;
}

function getSwapItemSlug(item: ApiSwapHistoryItem, asset: string) {
  if (asset === TON_SYMBOL) return TON_TOKEN_SLUG;
  if (item.cex) return asset;
  return buildTokenSlug(asset);
}

export async function swapReplaceTransactions(
  accountId: string,
  transactions: ApiTransactionActivity[],
  slug?: string,
): Promise<ApiActivity[]> {
  if (!transactions.length) {
    return transactions;
  }

  try {
    const address = await fetchStoredAddress(accountId);

    const firstLt = parseTxId(transactions[0].txId).lt;
    const lastLt = parseTxId(transactions[transactions.length - 1].txId).lt;

    const firstTimestamp = transactions[0].timestamp;
    const lastTimestamp = transactions[transactions.length - 1].timestamp;

    const [fromLt, fromTimestamp] = firstLt > lastLt ? [lastLt, lastTimestamp] : [firstLt, firstTimestamp];
    const [toLt, toTimestamp] = firstLt > lastLt ? [firstLt, firstTimestamp] : [lastLt, lastTimestamp];

    const waitUntil = Date.now() + SWAP_WAITING_TIME;
    while (Date.now() < waitUntil) {
      const pendingSwaps = await swapGetHistory(address, {
        status: 'pending',
        isCex: false,
      });
      if (!pendingSwaps.length) {
        break;
      }
      await pause(SWAP_WAITING_PAUSE);
    }

    const swaps = await swapGetHistory(address, {
      fromLt, toLt, fromTimestamp, toTimestamp,
    });

    if (!swaps.length) {
      return transactions;
    }

    const skipLtRanges: LtRange[] = [...pendingLtRanges];
    const result: ApiActivity[] = [];

    for (const swap of swaps) {
      if (swap.lt) {
        skipLtRanges.push([swap.lt, swap.lt + SWAP_MAX_LT]);
      }

      const swapActivity = swapItemToActivity(swap);

      if (slug && swapActivity.from !== slug && swapActivity.to !== slug) {
        continue;
      }
      result.push(swapActivity);
    }

    for (const transaction of transactions) {
      const lt = parseTxId(transaction.txId).lt;
      const swapIndex = skipLtRanges.findIndex(([startLt, endLt]) => lt >= startLt && lt <= endLt);

      if (swapIndex < 0) {
        result.push(transaction);
      } else {
        result.push({
          ...transaction,
          shouldHide: true,
        });
      }
    }

    return result;
  } catch (err) {
    logDebugError('swapReplaceTransactions', err);
    return transactions;
  }
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

export function swapEstimate(params: ApiSwapEstimateRequest): Promise<ApiSwapEstimateResponse | { error: string }> {
  return callBackendPost('/swap/ton/estimate', params, {
    isAllowBadRequest: true,
  });
}

export function swapBuild(authToken: string, params: ApiSwapBuildRequest): Promise<ApiSwapBuildResponse> {
  return callBackendPost('/swap/ton/build', params, {
    authToken,
  });
}

export function swapGetAssets(): Promise<ApiSwapAsset[]> {
  return callBackendGet('/swap/assets');
}

export function swapGetTonCurrencies(): Promise<ApiSwapTonAsset[]> {
  return callBackendGet('/swap/ton/tokens');
}

export function swapGetPairs(symbolOrMinter: string): Promise<ApiSwapPairAsset[]> {
  return callBackendGet('/swap/pairs', { asset: symbolOrMinter });
}

export function swapGetHistory(address: string, params: {
  fromLt?: number;
  toLt?: number;
  fromTimestamp?: number;
  toTimestamp?: number;
  status?: ApiSwapHistoryItem['status'];
  isCex?: boolean;
}): Promise<ApiSwapHistoryItem[]> {
  return callBackendGet(`/swap/history/${address}`, params);
}

export function swapGetHistoryItem(address: string, id: number): Promise<ApiSwapHistoryItem> {
  return callBackendGet(`/swap/history/${address}/${id}`);
}

export function swapCexEstimate(params: ApiSwapCexEstimateRequest): Promise<ApiSwapCexEstimateResponse> {
  return callBackendPost('/swap/cex/estimate', params);
}

export function swapCexValidateAddress(params: { slug: string; address: string }): Promise<{
  result: boolean;
  message?: string;
}> {
  return callBackendGet('/swap/cex/validate-address', params);
}

export async function swapCexCreateTransaction(
  accountId: string,
  password: string,
  params: ApiSwapCexCreateTransactionRequest,
): Promise<{ swap: ApiSwapHistoryItem; activity: ApiSwapActivity }> {
  const authToken = await getBackendAuthToken(accountId, password);

  const { swap } = await callBackendPost<ApiSwapCexCreateTransactionResponse>('/swap/cex/createTransaction', params, {
    authToken,
  });
  const activity = swapItemToActivity(swap);

  onUpdate({
    type: 'newActivities',
    accountId,
    activities: [activity],
  });

  void callHook('onSwapCreated', accountId, swap.timestamp - 1);

  return { swap, activity };
}

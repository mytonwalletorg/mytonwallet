import type { TonTransferParams } from '../blockchains/ton/types';
import type {
  ApiActivity,
  ApiNetwork,
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
  ApiTransaction,
  ApiTransactionActivity,
  OnApiUpdate,
} from '../types';

import { TON_SYMBOL, TON_TOKEN_SLUG } from '../../config';
import { parseAccountId } from '../../util/account';
import { assert } from '../../util/assert';
import { fromDecimal } from '../../util/decimals';
import { logDebugError } from '../../util/logs';
import { pause } from '../../util/schedulers';
import { buildSwapId } from '../../util/swap/buildSwapId';
import blockchains from '../blockchains';
import { buildTokenSlug, parseTxId } from '../blockchains/ton/util';
import { fetchStoredAddress } from '../common/accounts';
import { callBackendGet, callBackendPost } from '../common/backend';
import { callHook } from '../hooks';
import { getBackendAuthToken } from './other';
import { resolveTokenBySlug } from './tokens';

export type SwapHistoryRange = {
  asset: string;
  fromLt: number;
  toLt: number;
  fromTime: number;
  toTime: number;
};

type LtRange = [number, number];

const SWAP_MAX_LT = 50;
const SWAP_WAITING_TIME = 5 * 60 * 1_000; // 5 min
const SWAP_WAITING_PAUSE = 1_000; // 1 sec
const MAX_OLD_SWAP_ID = 41276;

const ton = blockchains.ton;

let onUpdate: OnApiUpdate;

export function initSwap(_onUpdate: OnApiUpdate) {
  onUpdate = _onUpdate;
}

export async function swapBuildTransfer(accountId: string, password: string, params: ApiSwapBuildRequest) {
  const { network } = parseAccountId(accountId);
  const authToken = await getBackendAuthToken(accountId, password);

  const address = await fetchStoredAddress(accountId);
  const { id, transfers } = await swapBuild(authToken, params);

  const transferList = transfers.map((transfer) => ({
    ...transfer,
    amount: BigInt(transfer.amount),
    isBase64Payload: true,
  }));

  await ton.validateDexSwapTransfers(network, address, params, transferList);

  const result = await ton.checkMultiTransactionDraft(accountId, transferList);

  if ('error' in result) {
    return result;
  }

  return { ...result, id, transfers };
}

export async function swapSubmit(
  accountId: string,
  password: string,
  fee: bigint,
  transfers: ApiSwapTransfer[],
  historyItem: ApiSwapHistoryItem,
) {
  const transferList = transfers.map((transfer) => ({
    ...transfer,
    amount: BigInt(transfer.amount),
    isBase64Payload: true,
  }));
  const result = await ton.submitMultiTransfer(accountId, password, transferList);

  if ('error' in result) {
    return result;
  }

  const from = getSwapItemSlug(historyItem, historyItem.from);
  const to = getSwapItemSlug(historyItem, historyItem.to);

  const swap: ApiSwapActivity = {
    ...historyItem,
    id: buildSwapId(historyItem.id),
    from,
    to,
    kind: 'swap',
  };

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
  network: ApiNetwork,
  slug?: string,
): Promise<ApiActivity[]> {
  if (!transactions.length || network === 'testnet') {
    return transactions;
  }

  try {
    const address = await fetchStoredAddress(accountId);
    const asset = slug ? resolveTokenBySlug(slug).minterAddress ?? TON_SYMBOL : undefined;
    const {
      fromLt, toLt, fromTime, toTime,
    } = buildSwapHistoryRange(transactions);

    const swaps = await swapGetHistory(address, {
      fromLt,
      toLt,
      fromTimestamp: fromTime,
      toTimestamp: toTime,
      asset,
    });

    if (!swaps.length) {
      return transactions;
    }

    return replaceTransactions(transactions, swaps);
  } catch (err) {
    logDebugError('swapReplaceTransactions', err);
    return transactions;
  }
}

export async function swapReplaceTransactionsByRanges(
  accountId: string,
  transactions: ApiTransactionActivity[],
  chunks: ApiTransactionActivity[][],
  isFirstLoad?: boolean,
): Promise<ApiActivity[]> {
  const { network } = parseAccountId(accountId);

  if (!chunks.length || network === 'testnet') {
    return transactions;
  }

  try {
    const address = await fetchStoredAddress(accountId);

    if (!isFirstLoad) {
      await waitPendingDexSwap(address);
    }

    const ranges = chunks.map((txs) => buildSwapHistoryRange(txs));
    const swaps = await swapGetHistoryByRanges(address, ranges);

    if (!swaps.length) {
      return [...transactions];
    }

    return replaceTransactions(transactions, swaps);
  } catch (err) {
    logDebugError('swapReplaceTransactionsByRanges', err);
    return [...transactions];
  }
}

function replaceTransactions(transactions: ApiTransactionActivity[], swaps: ApiSwapHistoryItem[]) {
  const result: ApiActivity[] = [];
  const hiddenTxIds = new Set<string>();

  const skipLtRanges: LtRange[] = []; // TODO Remove it after applying correcting script in backend

  for (const swap of swaps) {
    swap.txIds?.forEach((txId) => {
      hiddenTxIds.add(txId);
    });

    if (swap.lt && Number(swap.id) < MAX_OLD_SWAP_ID) {
      skipLtRanges.push([swap.lt, swap.lt + SWAP_MAX_LT]);
    }

    const swapActivity = swapItemToActivity(swap);

    result.push(swapActivity);
  }

  for (let transaction of transactions) {
    const [ltString, hash] = transaction.txId.split(':');
    const lt = Number(ltString);
    const shortenedTxId = `${lt}:${hash}`;

    const shouldHide = Boolean(
      hiddenTxIds.has(shortenedTxId)
      || skipLtRanges.find(([startLt, endLt]) => lt >= startLt && lt <= endLt),
    );

    if (shouldHide) {
      transaction = { ...transaction, shouldHide };
    }
    result.push(transaction);
  }

  return result;
}

async function waitPendingDexSwap(address: string) {
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
}

function buildSwapHistoryRange(transactions: ApiTransaction[]): SwapHistoryRange {
  const firstLt = parseTxId(transactions[0].txId).lt;
  const lastLt = parseTxId(transactions[transactions.length - 1].txId).lt;

  const firstTimestamp = transactions[0].timestamp;
  const lastTimestamp = transactions[transactions.length - 1].timestamp;

  const [fromLt, fromTime] = firstLt > lastLt ? [lastLt, lastTimestamp] : [firstLt, firstTimestamp];
  const [toLt, toTime] = firstLt > lastLt ? [firstLt, firstTimestamp] : [lastLt, lastTimestamp];

  const slug = transactions[0].slug;
  const asset = slug === TON_TOKEN_SLUG ? TON_SYMBOL : resolveTokenBySlug(slug).minterAddress!;

  return {
    asset,
    fromLt: Math.floor(fromLt / 100) * 100,
    toLt,
    fromTime,
    toTime,
  };
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
  asset?: string;
}): Promise<ApiSwapHistoryItem[]> {
  return callBackendGet(`/swap/history/${address}`, params);
}

export function swapGetHistoryByRanges(address: string, ranges: SwapHistoryRange[]): Promise<ApiSwapHistoryItem[]> {
  return callBackendPost(`/swap/history-ranges/${address}`, { ranges });
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
): Promise<{
    swap: ApiSwapHistoryItem;
    activity: ApiSwapActivity;
    transfer?: TonTransferParams;
  }> {
  const authToken = await getBackendAuthToken(accountId, password);

  const { swap } = await callBackendPost<ApiSwapCexCreateTransactionResponse>('/swap/cex/createTransaction', params, {
    authToken,
  });
  const activity = swapItemToActivity(swap);

  let transfer: {
    toAddress: string;
    amount: bigint;
  } | undefined;

  if (params.from === TON_SYMBOL) {
    transfer = {
      toAddress: swap.cex!.payinAddress,
      amount: fromDecimal(swap.fromAmount),
    };

    assert(transfer.amount <= fromDecimal(params.fromAmount));
  }

  onUpdate({
    type: 'newActivities',
    accountId,
    activities: [activity],
  });

  void callHook('onSwapCreated', accountId, swap.timestamp - 1);

  return { swap, activity, transfer };
}

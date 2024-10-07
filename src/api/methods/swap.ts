import type { TonTransferParams } from '../chains/ton/types';
import type {
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
  OnApiUpdate,
} from '../types';

import { TONCOIN } from '../../config';
import { parseAccountId } from '../../util/account';
import { buildSwapId } from '../../util/swap/buildSwapId';
import chains from '../chains';
import { fetchStoredTonWallet } from '../common/accounts';
import { callBackendGet, callBackendPost } from '../common/backend';
import { getSwapItemSlug, swapGetHistoryItem, swapItemToActivity } from '../common/swap';
import { callHook } from '../hooks';
import { getBackendAuthToken } from './other';

export type SwapHistoryRange = {
  asset: string;
  fromLt: number;
  toLt: number;
  fromTime: number;
  toTime: number;
};

const ton = chains.ton;

let onUpdate: OnApiUpdate;

export function initSwap(_onUpdate: OnApiUpdate) {
  onUpdate = _onUpdate;
}

export async function swapBuildTransfer(
  accountId: string,
  password: string,
  request: ApiSwapBuildRequest,
) {
  const { network } = parseAccountId(accountId);
  const authToken = await getBackendAuthToken(accountId, password);

  const { address } = await fetchStoredTonWallet(accountId);
  const { id, transfers } = await swapBuild(authToken, request);

  const transferList = transfers.map((transfer) => ({
    ...transfer,
    amount: BigInt(transfer.amount),
    isBase64Payload: true,
  }));

  await ton.validateDexSwapTransfers(network, address, request, transferList);

  const result = await ton.checkMultiTransactionDraft(accountId, transferList, request.shouldTryDiesel);

  if ('error' in result) {
    return result;
  }

  return { ...result, id, transfers };
}

export async function swapSubmit(
  accountId: string,
  password: string,
  transfers: ApiSwapTransfer[],
  historyItem: ApiSwapHistoryItem,
  isGasless?: boolean,
) {
  const { address } = await fetchStoredTonWallet(accountId);
  const transferList: TonTransferParams[] = transfers.map((transfer) => ({
    ...transfer,
    amount: BigInt(transfer.amount),
    isBase64Payload: true,
  }));

  if (historyItem.from !== TONCOIN.symbol) {
    transferList[0] = await ton.insertMintlessPayload('mainnet', address, historyItem.from, transferList[0]);
  }

  const result = await ton.submitMultiTransfer({
    accountId, password, messages: transferList, isGasless,
  });

  if ('error' in result) {
    return result;
  }

  delete result.messages[0].stateInit;

  const from = getSwapItemSlug(historyItem, historyItem.from);
  const to = getSwapItemSlug(historyItem, historyItem.to);

  const swap: ApiSwapActivity = {
    ...historyItem,
    id: buildSwapId(historyItem.id),
    from,
    to,
    kind: 'swap',
  };

  const authToken = await getBackendAuthToken(accountId, password);

  await callBackendPost(`/swap/history/${address}/${historyItem.id}/update`, {
    msgHash: result.msgHash,
  }, {
    method: 'PATCH',
    authToken,
  });

  onUpdate({
    type: 'newActivities',
    chain: 'ton',
    accountId,
    activities: [swap],
  });

  void callHook('onSwapCreated', accountId, swap.timestamp - 1);

  return result;
}

export async function fetchSwaps(accountId: string, ids: string[]) {
  const { address } = await fetchStoredTonWallet(accountId);
  const results = await Promise.allSettled(
    ids.map((id) => swapGetHistoryItem(address, id.replace('swap:', ''))),
  );

  return results
    .map((result) => (result.status === 'fulfilled' ? result.value : undefined))
    .filter(Boolean)
    .map(swapItemToActivity);
}

export function swapEstimate(request: ApiSwapEstimateRequest): Promise<ApiSwapEstimateResponse | { error: string }> {
  return callBackendPost('/swap/ton/estimate', request, {
    isAllowBadRequest: true,
  });
}

export function swapBuild(authToken: string, request: ApiSwapBuildRequest): Promise<ApiSwapBuildResponse> {
  return callBackendPost('/swap/ton/build', {
    ...request,
    isMsgHashMode: true,
  }, {
    authToken,
  });
}

export function swapGetAssets(): Promise<ApiSwapAsset[]> {
  return callBackendGet('/swap/assets');
}

export function swapGetTonCurrencies(): Promise<ApiSwapTonAsset[]> {
  return callBackendGet('/swap/ton/tokens');
}

export function swapGetPairs(symbolOrTokenAddress: string): Promise<ApiSwapPairAsset[]> {
  return callBackendGet('/swap/pairs', { asset: symbolOrTokenAddress });
}

export function swapCexEstimate(request: ApiSwapCexEstimateRequest): Promise<ApiSwapCexEstimateResponse> {
  return callBackendPost('/swap/cex/estimate', request, { isAllowBadRequest: true });
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
  request: ApiSwapCexCreateTransactionRequest,
): Promise<{
    swap: ApiSwapHistoryItem;
    activity: ApiSwapActivity;
  }> {
  const authToken = await getBackendAuthToken(accountId, password);

  const { swap } = await callBackendPost<ApiSwapCexCreateTransactionResponse>('/swap/cex/createTransaction', request, {
    authToken,
  });
  const activity = swapItemToActivity(swap);

  onUpdate({
    type: 'newActivities',
    chain: 'ton',
    accountId,
    activities: [activity],
  });

  void callHook('onSwapCreated', accountId, swap.timestamp - 1);

  return { swap, activity };
}

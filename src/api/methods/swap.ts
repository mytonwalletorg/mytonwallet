import type {
  ApiSwapBuildRequest,
  ApiSwapBuildResponse,
  ApiSwapCurrency,
  ApiSwapEstimateRequest,
  ApiSwapEstimateResponse,
  ApiSwapShortCurrency,
  ApiSwapTonCurrency,
} from '../types';

import { callBackendGet, callBackendPost } from '../common/backend';

export function swapEstimate(params: ApiSwapEstimateRequest): Promise<ApiSwapEstimateResponse> {
  return callBackendPost('/swap/ton/estimate', params);
}

export function swapBuild(params: ApiSwapBuildRequest): Promise<ApiSwapBuildResponse> {
  return callBackendPost('/swap/ton/build', params);
}

export function swapGetCurrencies(): Promise<ApiSwapCurrency[]> {
  return callBackendGet('/swap/currencies');
}

export function swapGetTonCurrencies(): Promise<ApiSwapTonCurrency[]> {
  return callBackendGet('/swap/ton/tokens');
}

export function swapGetTonPairs(): Promise<ApiSwapShortCurrency[]> {
  return callBackendGet('/swap/ton/pairs');
}

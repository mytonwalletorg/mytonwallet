import type { ApiBaseCurrency, ApiHistoryList, ApiPriceHistoryPeriod } from '../types';

import { DEFAULT_PRICE_CURRENCY, TON_SYMBOL } from '../../config';
import { callBackendGet } from '../common/backend';
import { storage } from '../storages';
import { waitDataPreload } from './preload';
import { resolveTokenBySlug } from './tokens';

export async function getBaseCurrency() {
  return (await storage.getItem('baseCurrency')) ?? DEFAULT_PRICE_CURRENCY;
}

export function setBaseCurrency(currency: ApiBaseCurrency) {
  return storage.setItem('baseCurrency', currency);
}

export async function fetchPriceHistory(
  slug: string,
  period: ApiPriceHistoryPeriod,
  baseCurrency: ApiBaseCurrency = DEFAULT_PRICE_CURRENCY,
): Promise<ApiHistoryList | undefined> {
  await waitDataPreload();
  const token = resolveTokenBySlug(slug);

  if (!token) {
    return [];
  }

  return callBackendGet(`/prices/chart/${token.minterAddress ?? TON_SYMBOL}`, {
    base: baseCurrency,
    period,
  });
}

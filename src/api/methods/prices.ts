import type { ApiBaseCurrency } from '../types';

import { DEFAULT_PRICE_CURRENCY } from '../../config';
import { storage } from '../storages';

export async function getBaseCurrency() {
  return (await storage.getItem('baseCurrency')) ?? DEFAULT_PRICE_CURRENCY;
}

export function setBaseCurrency(currency: ApiBaseCurrency) {
  return storage.setItem('baseCurrency', currency);
}

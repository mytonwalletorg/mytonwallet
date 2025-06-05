import type { ApiTransaction } from '../api/types';

import { TRANSACTION_ADDRESS_SHIFT } from '../config';
import { shortenAddress } from './shortenAddress';

const cache = new Map<string, {
  timestamp: number;
  amount: bigint;
  address: string;
}>();

function getKey(address: string) {
  return shortenAddress(address, TRANSACTION_ADDRESS_SHIFT)!;
}

function addToCache(address: string, amount: bigint, timestamp: number) {
  const key = getKey(address);

  cache.set(key, {
    address,
    amount,
    timestamp,
  });
}

function getFromCache(address: string) {
  const key = getKey(address);

  return cache.get(key);
}

export function updatePoisoningCache(tx: ApiTransaction) {
  const { fromAddress: address, amount, timestamp } = tx;

  const cached = getFromCache(address);

  if (!cached || cached.timestamp < timestamp || (cached.timestamp === timestamp && cached.amount > amount)) {
    addToCache(address, amount, timestamp);
  }
}

export function getIsTransactionWithPoisoning(tx: ApiTransaction) {
  const { fromAddress: address } = tx;

  const cached = getFromCache(address);

  return cached && cached.address !== address;
}

export function clearPoisoningCache() {
  cache.clear();
}

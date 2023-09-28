import type { ApiToken, ApiTransaction } from '../../api/types';

import { DEFAULT_DECIMAL_PLACES, TINY_TRANSFER_MAX_COST } from '../../config';

export function getIsTinyTransaction(transaction: ApiTransaction, token?: ApiToken) {
  if (!token) return false;
  const decimals = token.decimals;
  const cost = Math.abs(bigStrToHuman(transaction.amount, decimals)) * token.quote.price;
  return cost < TINY_TRANSFER_MAX_COST;
}

export function bigStrToHuman(amount: string, decimalPlaces = DEFAULT_DECIMAL_PLACES) {
  return divideBigInt(BigInt(amount), BigInt(10 ** decimalPlaces));
}

export function humanToBigStr(amount: number, decimalPlaces = DEFAULT_DECIMAL_PLACES) {
  return String(Math.round(amount * (10 ** decimalPlaces)));
}

function divideBigInt(a: bigint, b: bigint) {
  const div = a / b;
  return Number(div) + Number(a - div * b) / Number(b);
}

export function getIsTxIdLocal(txId: string) {
  return txId.includes('|');
}

export function getIsSwapId(id: string) {
  return id.startsWith('swap:');
}

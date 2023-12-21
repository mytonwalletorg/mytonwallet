import TonWeb from 'tonweb';

import { STAKING_POOLS } from '../../config';
import { ApiServerError } from '../errors';

export function bytesToHex(bytes: Uint8Array) {
  return TonWeb.utils.bytesToHex(bytes);
}

export function hexToBytes(hex: string) {
  return TonWeb.utils.hexToBytes(hex);
}

export function bytesToBase64(bytes: Uint8Array) {
  return TonWeb.utils.bytesToBase64(bytes);
}

export function base64ToBytes(base64: string) {
  return TonWeb.utils.base64ToBytes(base64);
}

export function hexToBase64(hex: string) {
  return bytesToBase64(hexToBytes(hex));
}

export function base64ToString(base64: string) {
  return TonWeb.utils.base64toString(base64);
}

export function sha256(bytes: Uint8Array) {
  return TonWeb.utils.sha256(bytes);
}

export function handleFetchErrors(response: Response, ignoreHttpCodes?: number[]) {
  if (!response.ok && (!ignoreHttpCodes?.includes(response.status))) {
    throw new Error(response.statusText);
  }
  return response;
}

export function sumBigString(a: string, b: string) {
  return (BigInt(a) + BigInt(b)).toString();
}

export function isKnownStakingPool(address: string) {
  return STAKING_POOLS.some((poolPart) => address.endsWith(poolPart));
}

export async function fetchJson(url: string, data?: AnyLiteral, init?: RequestInit) {
  const urlObject = new URL(url);
  if (data) {
    Object.entries(data).forEach(([key, value]) => {
      if (value === undefined) return;
      urlObject.searchParams.set(key, value.toString());
    });
  }

  const response = await fetch(urlObject, init);
  if (!response.ok) {
    throw new ApiServerError(`Http error ${response.status}`);
  }
  return response.json();
}

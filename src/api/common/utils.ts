import { STAKING_POOLS } from '../../config';
import { ApiServerError } from '../errors';

export function sha256(bytes: Uint8Array) {
  return crypto.subtle.digest('SHA-256', bytes);
}

export function bytesToHex(bytes: Uint8Array) {
  return Buffer.from(bytes).toString('hex');
}

export function hexToBytes(hex: string) {
  return Uint8Array.from(Buffer.from(hex, 'hex'));
}

export function bytesToBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString('base64');
}

export function base64ToBytes(base64: string) {
  return Uint8Array.from(Buffer.from(base64, 'base64'));
}

export function base64ToString(base64: string) {
  return Buffer.from(base64, 'base64').toString('utf-8');
}

export function handleFetchErrors(response: Response, ignoreHttpCodes?: number[]) {
  if (!response.ok && (!ignoreHttpCodes?.includes(response.status))) {
    throw new Error(response.statusText);
  }
  return response;
}

export function isKnownStakingPool(address: string) {
  return STAKING_POOLS.some((poolPart) => address.endsWith(poolPart));
}

type QueryParams = Record<string, string | number | boolean | string[]>;

export async function fetchJson(url: string, data?: QueryParams, init?: RequestInit) {
  const urlObject = new URL(url);
  if (data) {
    Object.entries(data).forEach(([key, value]) => {
      if (value === undefined) {
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((item) => {
          urlObject.searchParams.append(key, item.toString());
        });
      } else {
        urlObject.searchParams.set(key, value.toString());
      }
    });
  }

  const response = await fetch(urlObject, init);
  if (!response.ok) {
    throw new ApiServerError(`Http error ${response.status}`);
  }
  return response.json();
}

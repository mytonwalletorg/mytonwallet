import type { ApiKnownAddresses } from '../types';

import { BRILLIANT_API_BASE_URL } from '../../config';
import { mapValues } from '../../util/iteratees';
import { logDebugError } from '../../util/logs';
import { handleFetchErrors } from './utils';

let knownAddresses: ApiKnownAddresses;
let scamMarkers: RegExp[];

export async function tryUpdateKnownAddresses() {
  try {
    const response = await fetch(`${BRILLIANT_API_BASE_URL}/known-addresses`);
    handleFetchErrors(response);
    if (!response.ok) return;

    const data = await response.json();

    knownAddresses = mapValues(data.knownAddresses as Record<string, string | any>, (value) => {
      return typeof value === 'string' ? { name: value } : value;
    });
    scamMarkers = (data.scamMarkers as string[]).map((x) => new RegExp(x, 'i'));
  } catch (err) {
    logDebugError('tryUpdateKnownAddresses', err);
  }
}

export function getKnownAddresses() {
  return knownAddresses;
}

export function getScamMarkers() {
  return scamMarkers;
}

export function getAddressInfo(address: string) {
  return knownAddresses[address];
}

import { BRILLIANT_API_BASE_URL, DEBUG } from '../../config';
import { handleFetchErrors } from './utils';
import { mapValues } from '../../util/iteratees';
import { ApiKnownAddresses } from '../types';

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
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error('[updateKnownAddresses]', err);
    }
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

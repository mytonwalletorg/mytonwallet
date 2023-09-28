import type { ApiKnownAddresses } from '../types';

import { mapValues } from '../../util/iteratees';
import { logDebugError } from '../../util/logs';
import { callBackendGet } from './backend';

let knownAddresses: ApiKnownAddresses = {};
let scamMarkers: RegExp[] = [];

export async function tryUpdateKnownAddresses() {
  try {
    const data = await callBackendGet('/known-addresses');

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

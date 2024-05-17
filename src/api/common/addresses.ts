import type { ApiAddressInfo, ApiKnownAddresses } from '../types';

import { logDebugError } from '../../util/logs';
import { callBackendGet } from './backend';

let knownAddresses: ApiKnownAddresses = {};
let scamMarkers: RegExp[] = [];
let trustedSites: Set<string> = new Set();

export async function tryUpdateKnownAddresses() {
  try {
    const data = await callBackendGet<{
      knownAddresses: Record<string, ApiKnownAddresses>;
      scamMarkers: string[];
      trustedSites: string[];
    }>('/known-addresses');

    knownAddresses = data.knownAddresses;
    scamMarkers = data.scamMarkers.map((x) => new RegExp(x, 'i'));
    trustedSites = new Set(data.trustedSites);
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

export function getKnownAddressInfo(address: string): ApiAddressInfo | undefined {
  return knownAddresses[address];
}

export function checkIsTrustedSite(domain: string) {
  return trustedSites.has(domain.toLowerCase());
}

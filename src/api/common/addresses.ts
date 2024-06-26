import type { ApiAddressInfo, ApiKnownAddresses } from '../types';

import {
  RE_FAKE_DOTS, RE_LINK_TEMPLATE, RE_TG_BOT_MENTION, RE_ZERO_WIDTH_SPACE,
} from '../../config';
import { logDebugError } from '../../util/logs';
import { callBackendGet } from './backend';

let knownAddresses: ApiKnownAddresses = {};
let scamMarkers: RegExp[] = [];
let trustedSites: Set<string> = new Set();
let trustedCollections: Set<string> = new Set();

export async function tryUpdateKnownAddresses() {
  try {
    const data = await callBackendGet<{
      knownAddresses: Record<string, ApiKnownAddresses>;
      scamMarkers: string[];
      trustedSites: string[];
      trustedCollections: string[];
    }>('/known-addresses');

    knownAddresses = data.knownAddresses;
    scamMarkers = data.scamMarkers.map((x) => new RegExp(x, 'i'));
    trustedSites = new Set(data.trustedSites);
    trustedCollections = new Set(data.trustedCollections);
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

export function checkIsTrustedCollection(address: string) {
  return trustedCollections.has(address);
}

export function checkHasScamLink(text: string) {
  const matches = text
    .replace(RE_ZERO_WIDTH_SPACE, '')
    .replace(RE_FAKE_DOTS, '.')
    .matchAll(RE_LINK_TEMPLATE);

  for (const match of matches) {
    const host = match.groups?.host;
    if (host && !checkIsTrustedSite(host)) {
      return true;
    }
  }

  return false;
}

export function checkHasTelegramBotMention(text: string) {
  return RE_TG_BOT_MENTION.test(text.replace(RE_ZERO_WIDTH_SPACE, ''));
}

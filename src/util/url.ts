import { logDebugError } from './logs';

// Regexp from https://stackoverflow.com/a/3809435
const URL_REGEX = /[-a-z0-9@:%._+~#=]{1,256}\.[a-z0-9()]{1,6}\b([-a-z0-9()@:%_+.~#?&/=]*)/gi;
const VALID_PROTOCOLS = new Set(['http:', 'https:']);

export function isValidUrl(url: string) {
  try {
    const match = url.match(URL_REGEX);
    if (!match) return false;

    const urlObject = new URL(url);

    return VALID_PROTOCOLS.has(urlObject.protocol);
  } catch (e) {
    logDebugError('isValidUrl', e);
    return false;
  }
}

export function getHostnameFromUrl(url: string) {
  try {
    const urlObject = new URL(url);

    return urlObject.hostname;
  } catch (e) {
    logDebugError('getHostnameFromUrl', e);
    return url;
  }
}

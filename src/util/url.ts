import {
  EMPTY_HASH_VALUE,
  TOKEN_EXPLORER_MAINNET_URL,
  TOKEN_EXPLORER_TESTNET_URL,
  TON_EXPLORER_BASE_MAINNET_URL,
  TON_EXPLORER_BASE_TESTNET_URL,
} from '../config';
import { base64ToHex } from './base64toHex';
import { logDebugError } from './logs';

// Regexp from https://stackoverflow.com/a/3809435
const URL_REGEX = /[-a-z0-9@:%._+~#=]{1,256}\.[a-z0-9()]{1,6}\b([-a-z0-9()@:%_+.~#?&/=]*)/gi;
const VALID_PROTOCOLS = new Set(['http:', 'https:']);

export function isValidUrl(url: string, validProtocols = VALID_PROTOCOLS) {
  try {
    const match = url.match(URL_REGEX);
    if (!match) return false;

    const urlObject = new URL(url);

    return validProtocols.has(urlObject.protocol);
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

function getTonExplorerBaseUrl(isTestnet = false) {
  return isTestnet ? TON_EXPLORER_BASE_TESTNET_URL : TON_EXPLORER_BASE_MAINNET_URL;
}

function getTokenExplorerBaseUrl(isTestnet = false) {
  return isTestnet ? TOKEN_EXPLORER_TESTNET_URL : TOKEN_EXPLORER_MAINNET_URL;
}

export function getTonExplorerTransactionUrl(transactionHash: string | undefined, isTestnet?: boolean) {
  if (!transactionHash || transactionHash === EMPTY_HASH_VALUE) return undefined;

  return `${getTonExplorerBaseUrl(isTestnet)}transaction/${base64ToHex(transactionHash)}`;
}

export function getTonExplorerAddressUrl(address?: string, isTestnet?: boolean) {
  if (!address) return undefined;

  return `${getTonExplorerBaseUrl(isTestnet)}${address}`;
}

export function getTonExplorerNftCollectionUrl(nftCollectionAddress?: string, isTestnet?: boolean) {
  if (!nftCollectionAddress) return undefined;

  return `${getTonExplorerBaseUrl(isTestnet)}${nftCollectionAddress}?section=overview`;
}

export function getTonExplorerNftUrl(nftAddress?: string, isTestnet?: boolean) {
  if (!nftAddress) return undefined;

  return `${getTonExplorerBaseUrl(isTestnet)}${nftAddress}?section=nft`;
}

export function getTonExplorerTokenUrl(slug?: string, address?: string, isTestnet?: boolean) {
  if (!slug && !address) return undefined;

  return address
    ? getTokenExplorerBaseUrl(isTestnet).replace('{address}', address)
    : `https://coinmarketcap.com/currencies/${slug}/`;
}

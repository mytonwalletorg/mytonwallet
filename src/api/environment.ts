/*
 * This module is to be used instead of /src/util/environment.ts
 * when `window` is not available (e.g. in a web worker).
 */
import type { ApiInitArgs } from './types';

import {
  APP_ENV,
  ELECTRON_TONHTTPAPI_MAINNET_API_KEY,
  ELECTRON_TONHTTPAPI_TESTNET_API_KEY,
  IS_CAPACITOR,
  IS_EXTENSION,
  TONHTTPAPI_MAINNET_API_KEY,
  TONHTTPAPI_TESTNET_API_KEY,
} from '../config';

// eslint-disable-next-line no-restricted-globals
export const X_APP_ORIGIN = self?.origin;

let environment: ApiInitArgs & {
  isDappSupported: boolean;
  isSseSupported: boolean;
  apiHeaders?: AnyLiteral;
  tonhttpapiMainnetKey?: string;
  tonhttpapiTestnetKey?: string;
};

export function setEnvironment(args: ApiInitArgs) {
  environment = {
    ...args,
    isDappSupported: IS_EXTENSION || IS_CAPACITOR || args.isElectron,
    isSseSupported: args.isElectron || IS_CAPACITOR,
    apiHeaders: IS_EXTENSION || (args.isElectron && APP_ENV !== 'development')
      // eslint-disable-next-line no-restricted-globals
      ? { 'X-App-Origin': X_APP_ORIGIN }
      : undefined,
    tonhttpapiMainnetKey: args.isElectron ? ELECTRON_TONHTTPAPI_MAINNET_API_KEY : TONHTTPAPI_MAINNET_API_KEY,
    tonhttpapiTestnetKey: args.isElectron ? ELECTRON_TONHTTPAPI_TESTNET_API_KEY : TONHTTPAPI_TESTNET_API_KEY,
  };
  return environment;
}

export function getEnvironment() {
  return environment;
}

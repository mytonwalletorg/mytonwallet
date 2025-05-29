/*
 * This module is to be used instead of /src/util/environment.ts
 * when `window` is not available (e.g. in a web worker).
 */
import type { ApiInitArgs } from './types';

import {
  ELECTRON_TONCENTER_MAINNET_KEY,
  ELECTRON_TONCENTER_TESTNET_KEY,
  IS_CAPACITOR,
  IS_EXTENSION,
  TONCENTER_MAINNET_KEY,
  TONCENTER_TESTNET_KEY,
} from '../config';

const ELECTRON_ORIGIN = 'file://';

let environment: ApiInitArgs & {
  isDappSupported?: boolean;
  isSseSupported?: boolean;
  apiHeaders?: AnyLiteral;
  toncenterMainnetKey?: string;
  toncenterTestnetKey?: string;
};

export function setEnvironment(args: ApiInitArgs) {
  environment = {
    ...args,
    isDappSupported: IS_EXTENSION || IS_CAPACITOR || args.isElectron,
    isSseSupported: args.isElectron || (IS_CAPACITOR && !args.isNativeBottomSheet),
    // eslint-disable-next-line no-restricted-globals
    apiHeaders: { 'X-App-Origin': args.isElectron ? ELECTRON_ORIGIN : self?.origin },
    toncenterMainnetKey: args.isElectron ? ELECTRON_TONCENTER_MAINNET_KEY : TONCENTER_MAINNET_KEY,
    toncenterTestnetKey: args.isElectron ? ELECTRON_TONCENTER_TESTNET_KEY : TONCENTER_TESTNET_KEY,
  };
  return environment;
}

export function getEnvironment() {
  return environment;
}

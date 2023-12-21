/*
 * This module is to be used instead of /src/util/environment.ts
 * when `window` is not available (e.g. in a web worker).
 */
import { APP_ENV, IS_ELECTRON_BUILD, IS_EXTENSION } from '../config';

// eslint-disable-next-line no-restricted-globals
export const IS_CHROME_EXTENSION = Boolean(self?.chrome?.system);

// eslint-disable-next-line no-restricted-globals
export const X_APP_ORIGIN = self.origin;
export const API_HEADERS = IS_EXTENSION || (IS_ELECTRON_BUILD && APP_ENV !== 'development')
  ? { 'X-App-Origin': X_APP_ORIGIN }
  : undefined;

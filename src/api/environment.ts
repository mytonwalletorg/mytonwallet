/*
 * This module is to be used instead of /src/util/environment.ts
 * when `window` is not available (e.g. in a web worker).
 */

// eslint-disable-next-line no-restricted-globals
export const IS_EXTENSION = Boolean(self?.chrome?.runtime?.id);
// eslint-disable-next-line no-restricted-globals
export const IS_CHROME_EXTENSION = Boolean(self?.chrome?.system);
export const IS_FIREFOX_EXTENSION = IS_EXTENSION && !IS_CHROME_EXTENSION;

export const IS_ELECTRON = process.env.IS_ELECTRON;

export const IS_DAPP_SUPPORTED = IS_EXTENSION || IS_ELECTRON;

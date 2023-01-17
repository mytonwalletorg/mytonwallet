/*
 * This module is to be used instead of /src/util/environment.ts
 * when `window` is not available (e.g. in a web worker).
 */

// eslint-disable-next-line no-restricted-globals
export const IS_EXTENSION = Boolean(self?.chrome?.runtime?.id);

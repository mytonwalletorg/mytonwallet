import { DEBUG } from '../config';

export function logDebugError(message: string, ...args: any[]) {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.error(`[DEBUG][${message}]`, ...args);
  }
}

export function logDebug(message: any, ...args: any[]) {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log(`[DEBUG] ${message}`, ...args);
  }
}

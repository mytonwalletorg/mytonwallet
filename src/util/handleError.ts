import { APP_ENV, DEBUG_ALERT_MSG } from '../config';
import { logDebugError } from './logs';
import { throttle } from './schedulers';

const noop = () => {
};

const throttledAlert = typeof window !== 'undefined' ? throttle(window.alert, 1000) : noop;

// eslint-disable-next-line no-restricted-globals
self.addEventListener('error', handleErrorEvent);
// eslint-disable-next-line no-restricted-globals
self.addEventListener('unhandledrejection', handleErrorEvent);

function handleErrorEvent(e: ErrorEvent | PromiseRejectionEvent) {
  // https://stackoverflow.com/questions/49384120/resizeobserver-loop-limit-exceeded
  if (e instanceof ErrorEvent && e.message === 'ResizeObserver loop limit exceeded') {
    return;
  }

  e.preventDefault();

  handleError(e instanceof ErrorEvent ? (e.error || e.message) : e.reason);
}

export function handleError(err: Error | string) {
  logDebugError('Unhadled UI Error', err);

  const message = typeof err === 'string' ? err : err.message;
  const stack = typeof err === 'object' ? err.stack : undefined;

  if (message.endsWith('Failed to import rlottie-wasm.js')) {
    return;
  }

  if (APP_ENV === 'development' || APP_ENV === 'staging') {
    throttledAlert(`${DEBUG_ALERT_MSG}\n\n${(message) || err}\n${stack}`);
  }
}

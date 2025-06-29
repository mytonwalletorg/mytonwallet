import { createCallbackManager } from './callbacks';
import { setCancellableTimeout } from './schedulers';

const focusListeners = createCallbackManager<NoneToVoidFunction>();

let isFocused = true;

/**
 * Calls `cb` when `ms` milliseconds pass if the app is focused at that moment.
 * Otherwise, waits until the app is focused or `forceMs` millisecond pass (since the very beginning).
 * Returns a function to cancel the timers.
 */
export function onFocusAwareDelay(ms: number, forceMs: number, cb: NoneToVoidFunction) {
  let cleanup: NoneToVoidFunction;

  const callCb = () => {
    cleanup();
    cb();
  };

  // Stage 1: waiting for the minimum time to pass
  cleanup = setCancellableTimeout(ms, () => {
    if (isFocused) {
      callCb();
    } else {
      // If the window is not focused, stage2: waiting for either the maximum time to pass or the window to get focused
      const unsubscribeFocus = focusListeners.addCallback(callCb);
      const cancelSecondTimeout = setCancellableTimeout(forceMs - ms, callCb);
      cleanup = () => {
        unsubscribeFocus();
        cancelSecondTimeout();
      };
    }
  });

  // We don't return just `cleanup` because it's not constant
  return () => cleanup();
}

/**
 * @see onFocusAwareDelay
 */
export function focusAwareDelay(ms: number, msWhenNotFocused: number) {
  return new Promise<void>((resolve) => {
    onFocusAwareDelay(ms, msWhenNotFocused, resolve);
  });
}

export function setIsAppFocused(_isFocused: boolean) {
  isFocused = _isFocused;

  if (_isFocused) {
    focusListeners.runCallbacks();
  }
}

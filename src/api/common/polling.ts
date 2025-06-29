import type { WalletPollingOptions } from './walletPolling';

import { onFocusAwareDelay } from '../../util/focusAwareDelay';
import { setCancellableTimeout } from '../../util/schedulers';
import { MINUTE, SEC } from '../constants';

export const activeWalletTiming = {
  updateOnStart: true,
  minUpdateDelay: { focused: SEC, notFocused: 3 * SEC },
  fallbackUpdateStartDelay: 3 * SEC,
  fallbackUpdatePeriod: { focused: 1.1 * SEC, notFocused: 10 * SEC },
  forceUpdatePeriod: { focused: MINUTE, notFocused: 2 * MINUTE },
} satisfies Partial<WalletPollingOptions>;

export const inactiveWalletTiming = {
  updateOnStart: false,
  minUpdateDelay: { focused: 5 * SEC, notFocused: 30 * SEC },
  fallbackUpdateStartDelay: 5 * SEC,
  fallbackUpdatePeriod: { focused: 30 * SEC, notFocused: MINUTE },
  forceUpdatePeriod: { focused: 2 * MINUTE, notFocused: 5 * MINUTE },
} satisfies Partial<WalletPollingOptions>;

interface PollingLoopOptions<Dep> {
  pause: number;
  pauseWhenNotFocused?: number;
  /** If `true`, `poll` won't be called at the loop start */
  skipInitialPoll?: boolean;
  /** Called before any `poll` call */
  prepare?: () => Promise<Dep>;
  /** Called periodically. If returns 'stop', the polling stops. */
  poll: (dependency: Dep) => MaybePromise<void | 'stop'>;
}

/**
 * Executes the given functions indefinitely with pauses.
 */
export function pollingLoop<Dep>({
  pause,
  pauseWhenNotFocused = pause,
  skipInitialPoll,
  prepare = () => Promise.resolve() as Promise<Dep>,
  poll,
}: PollingLoopOptions<Dep>) {
  let isStopped = false;
  let cancelPause: NoneToVoidFunction | undefined;
  let dependencies: Dep;

  async function iteration() {
    try {
      const response = await poll(dependencies);
      if (response === 'stop') {
        isStopped = true;
      }
    } finally {
      if (!isStopped) {
        scheduleIteration();
      }
    }
  }

  function scheduleIteration() {
    cancelPause = onFocusAwareDelay(pause, pauseWhenNotFocused, iteration);
  }

  void prepare().then((_dependencies) => {
    if (isStopped) {
      return;
    }

    dependencies = _dependencies;

    if (skipInitialPoll) {
      scheduleIteration();
    } else {
      void iteration();
    }
  });

  return () => {
    isStopped = true;
    cancelPause?.();
  };
}

/**
 * Wraps the given `action` function. When the wrapped function is executed, it executes `action` immediately, and
 * several times after that. The number of additional executions is equal to `pauses.length`. Each number in `pauses` is
 * the pause (in milliseconds) between the `action` executions. When the wrapped function is executed, the previously
 * scheduled additional executions are cancelled.
 *
 * `attemptNumber` starts from 0 and increments with each additional execution.
 */
export function withDoubleCheck<Args extends unknown[], Result>(
  pauses: number[],
  action: (attemptNumber: number, ...args: Args) => MaybePromise<Result>,
) {
  let isStopped = false;
  let cancelDoubleCheck: NoneToVoidFunction | undefined;

  async function makeAttempt(attemptNumber: number, args: Args) {
    cancelDoubleCheck?.();

    try {
      return await action(attemptNumber, ...args);
    } finally {
      if (!isStopped && attemptNumber < pauses.length) {
        cancelDoubleCheck?.(); // Cancelling again due to possible race conditions
        cancelDoubleCheck = setCancellableTimeout(
          pauses[attemptNumber],
          () => makeAttempt(attemptNumber + 1, args),
        );
      }
    }
  }

  return {
    /** Executes `actions` and returns the result of the first execution */
    run(...args: Args) {
      isStopped = false;
      return makeAttempt(0, args);
    },
    /** Cancels the scheduled additional executions */
    cancel() {
      isStopped = true;
      cancelDoubleCheck?.();
    },
  };
}

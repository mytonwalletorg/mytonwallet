import Deferred from './Deferred';

export type Scheduler = typeof requestAnimationFrame | typeof onTickEnd;

export function debounce<F extends AnyToVoidFunction>(
  fn: F,
  ms: number,
  shouldRunFirst = true,
  shouldRunLast = true,
) {
  let waitingTimeout: number | undefined;

  return (...args: Parameters<F>) => {
    if (waitingTimeout) {
      clearTimeout(waitingTimeout);
      waitingTimeout = undefined;
    } else if (shouldRunFirst) {
      fn(...args);
    }

    waitingTimeout = self.setTimeout(() => {
      if (shouldRunLast) {
        fn(...args);
      }

      waitingTimeout = undefined;
    }, ms);
  };
}

export function throttle<F extends AnyToVoidFunction>(
  fn: F,
  ms: number,
  shouldRunFirst = true,
) {
  let interval: number | undefined;
  let isPending: boolean;
  let args: Parameters<F>;

  return (..._args: Parameters<F>) => {
    isPending = true;
    args = _args;

    if (!interval) {
      if (shouldRunFirst) {
        isPending = false;
        fn(...args);
      }

      interval = self.setInterval(() => {
        if (!isPending) {
          self.clearInterval(interval);
          interval = undefined;
          return;
        }

        isPending = false;
        fn(...args);
      }, ms);
    }
  };
}

export function throttleWithTickEnd<F extends AnyToVoidFunction>(fn: F) {
  return throttleWith(onTickEnd, fn);
}

export function throttleWith<F extends AnyToVoidFunction>(schedulerFn: Scheduler, fn: F) {
  let waiting = false;
  let args: Parameters<F>;

  return (..._args: Parameters<F>) => {
    args = _args;

    if (!waiting) {
      waiting = true;

      schedulerFn(() => {
        waiting = false;
        fn(...args);
      });
    }
  };
}

export const pause = (ms: number) => new Promise<void>((resolve) => {
  setTimeout(() => resolve(), ms);
});

export function rafPromise() {
  return new Promise<void>((resolve) => {
    fastRaf(resolve);
  });
}

const FAST_RAF_TIMEOUT_FALLBACK_MS = 35; // < 30 FPS

let fastRafCallbacks: Set<NoneToVoidFunction> | undefined;
let fastRafFallbackCallbacks: Set<NoneToVoidFunction> | undefined;
let fastRafFallbackTimeout: number | undefined;

// May result in an immediate execution if called from another RAF callback which was scheduled
// (and therefore is executed) earlier than RAF callback scheduled by `fastRaf`
export function fastRaf(callback: NoneToVoidFunction, withTimeoutFallback = false) {
  if (!fastRafCallbacks) {
    fastRafCallbacks = new Set([callback]);

    requestAnimationFrame(() => {
      const currentCallbacks = fastRafCallbacks!;

      fastRafCallbacks = undefined;
      fastRafFallbackCallbacks = undefined;

      if (fastRafFallbackTimeout) {
        clearTimeout(fastRafFallbackTimeout);
        fastRafFallbackTimeout = undefined;
      }

      currentCallbacks.forEach((cb) => cb());
    });
  } else {
    fastRafCallbacks.add(callback);
  }

  if (withTimeoutFallback) {
    if (!fastRafFallbackCallbacks) {
      fastRafFallbackCallbacks = new Set([callback]);
    } else {
      fastRafFallbackCallbacks.add(callback);
    }

    if (!fastRafFallbackTimeout) {
      fastRafFallbackTimeout = window.setTimeout(() => {
        const currentTimeoutCallbacks = fastRafFallbackCallbacks!;

        if (fastRafCallbacks) {
          currentTimeoutCallbacks.forEach(fastRafCallbacks.delete, fastRafCallbacks);
        }
        fastRafFallbackCallbacks = undefined;

        if (fastRafFallbackTimeout) {
          clearTimeout(fastRafFallbackTimeout);
          fastRafFallbackTimeout = undefined;
        }

        currentTimeoutCallbacks.forEach((cb) => cb());
      }, FAST_RAF_TIMEOUT_FALLBACK_MS);
    }
  }
}

let onTickEndCallbacks: NoneToVoidFunction[] | undefined;

export function onTickEnd(callback: NoneToVoidFunction) {
  if (!onTickEndCallbacks) {
    onTickEndCallbacks = [callback];

    void Promise.resolve().then(() => {
      const currentCallbacks = onTickEndCallbacks!;
      onTickEndCallbacks = undefined;
      currentCallbacks.forEach((cb) => cb());
    });
  } else {
    onTickEndCallbacks.push(callback);
  }
}

const IDLE_TIMEOUT = 500;

let onIdleCallbacks: NoneToVoidFunction[] | undefined;

export function onIdle(callback: NoneToVoidFunction) {
  if (!self.requestIdleCallback) {
    onTickEnd(callback);
    return;
  }

  if (!onIdleCallbacks) {
    onIdleCallbacks = [callback];

    requestIdleCallback((deadline) => {
      const currentCallbacks = onIdleCallbacks!;
      onIdleCallbacks = undefined;

      while (currentCallbacks.length) {
        const cb = currentCallbacks.shift()!;
        cb();

        if (!deadline.timeRemaining()) break;
      }

      if (currentCallbacks.length) {
        if (onIdleCallbacks) {
          // Prepend the remaining callbacks if the next pass is already planned
          onIdleCallbacks = currentCallbacks.concat(onIdleCallbacks);
        } else {
          currentCallbacks.forEach(onIdle);
        }
      }
    }, { timeout: IDLE_TIMEOUT });
  } else {
    onIdleCallbacks.push(callback);
  }
}

let beforeUnloadCallbacks: NoneToVoidFunction[] | undefined;

export function onBeforeUnload(callback: NoneToVoidFunction, isLast = false) {
  if (!beforeUnloadCallbacks) {
    beforeUnloadCallbacks = [];

    self.addEventListener('beforeunload', () => {
      beforeUnloadCallbacks!.forEach((cb) => cb());
    });
  }

  if (isLast) {
    beforeUnloadCallbacks.push(callback);
  } else {
    beforeUnloadCallbacks.unshift(callback);
  }

  return () => {
    beforeUnloadCallbacks = beforeUnloadCallbacks!.filter((cb) => cb !== callback);
  };
}

export async function waitFor(cb: () => boolean, interval: number, attempts: number) {
  let i = 0;
  let result = cb();

  while (!result && i < attempts) {
    await pause(interval);

    i++;
    result = cb();
  }

  return result;
}

/**
 * Returns a function that executes every given functions (tasks) with limited concurrency (not more than
 * `maxConcurrency` at a time). The tasks are executed in the same order that they are given. Unlike throttle, executes
 * every given task.
 */
export function createTaskQueue(maxConcurrency = 1) {
  const queue: AnyAsyncFunction[] = [];
  let concurrency = 0;

  const runTasks = async () => {
    concurrency++;
    while (queue.length) {
      const task = queue.shift()!;
      await task(); // Expected never to throw, because the errors are caught below
    }
    concurrency--;
  };

  /** Schedules execution of the given function right now. The returned promise settles with the task result. */
  const run = <T>(task: () => MaybePromise<T>): Promise<T> => {
    const deferred = new Deferred<T>();
    queue.push(async () => {
      try {
        deferred.resolve(await task());
      } catch (err) {
        deferred.reject(err);
      }
    });

    if (concurrency < maxConcurrency) {
      void runTasks();
    }

    return deferred.promise;
  };

  /** Returns the same task function, but with limited concurrency */
  const wrap = <Args extends unknown[], Return>(
    task: (...args: Args) => MaybePromise<Return>,
  ): (...args: Args) => Promise<Return> => {
    return (...args: Args) => run(() => task(...args));
  };

  return { run, wrap };
}

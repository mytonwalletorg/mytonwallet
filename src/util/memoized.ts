import { areSortedArraysEqual } from './iteratees';

const cache = new WeakMap<AnyFunction, {
  lastArgs: any[];
  lastResult: any;
  lastTime: number;
  isDisabledUntil?: number;
}>();

export default function memoized<T extends AnyFunction>(fn: T, ttlSeconds?: number) {
  const wrapper = (...args: Parameters<T>): ReturnType<T> => {
    const cached = cache.get(fn);
    const now = Date.now();

    if (cached) {
      const isCacheDisabled = cached.isDisabledUntil && cached.isDisabledUntil > now;
      const isStale = ttlSeconds && cached.lastTime + (ttlSeconds * 1000) < now;

      if (!isCacheDisabled && !isStale && areSortedArraysEqual(cached.lastArgs, args)) {
        return cached.lastResult;
      }
    }

    const result = fn(...args);
    cache.set(fn, {
      ...cached,
      lastArgs: args,
      lastResult: result,
      lastTime: now,
    });
    return result;
  };

  wrapper.disableCache = (seconds: number) => {
    const cached = cache.get(fn);
    if (cached) {
      cached.isDisabledUntil = Date.now() + (seconds * 1000);
    }
  };

  return wrapper;
}

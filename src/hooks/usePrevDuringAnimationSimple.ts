import { useEffect, useState } from '../lib/teact/teact';

// Use previous value during animation without checking for presence
export function usePrevDuringAnimationSimple<T>(current: T, durationMs: number = 300): T {
  const [prev, setPrev] = useState<T>(current);

  useEffect(() => {
    if (current === prev) return undefined;
    const timeoutId = window.setTimeout(() => {
      setPrev(current);
    }, durationMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [current, durationMs, prev]);

  return prev;
}

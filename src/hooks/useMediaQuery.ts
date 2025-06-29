/**
 * Pulled from @react-hookz/web library source with some edits to match the code-style and use Teact
 * See https://github.com/react-hookz/web/blob/master/src/useMediaQuery/useMediaQuery.ts
 */

import type { Dispatch } from 'react';
import { useEffect, useState } from '../lib/teact/teact';

type QueryStateSetter = (matches: boolean) => void;

// eslint-disable-next-line @stylistic/max-len
const queriesMap = new Map<string, { mql: MediaQueryList; dispatchers: Set<Dispatch<boolean>>; listener: () => void }>();

const createQueryEntry = (query: string) => {
  const mql = matchMedia(query);
  const dispatchers = new Set<QueryStateSetter>();
  const listener = () => {
    dispatchers.forEach((d) => d(mql.matches));
  };

  if (mql.addEventListener) mql.addEventListener('change', listener, { passive: true });
  else mql.addListener(listener);

  return {
    mql,
    dispatchers,
    listener,
  };
};

const querySubscribe = (query: string, setState: QueryStateSetter) => {
  let entry = queriesMap.get(query);

  if (!entry) {
    entry = createQueryEntry(query);
    queriesMap.set(query, entry);
  }

  entry.dispatchers.add(setState);
  setState(entry.mql.matches);
};

const queryUnsubscribe = (query: string, setState: QueryStateSetter): void => {
  const entry = queriesMap.get(query);

  if (!entry) {
    return;
  }

  const { mql, dispatchers, listener } = entry;
  dispatchers.delete(setState);

  if (!dispatchers.size) {
    queriesMap.delete(query);

    if (mql.removeEventListener) mql.removeEventListener('change', listener);
    else mql.removeListener(listener);
  }
};

interface UseMediaQueryOptions {
  initializeWithValue?: boolean;
}

/**
 * Tracks the state of CSS media query.
 *
 * @param query CSS media query to track.
 * @param options Hook options:
 * `initializeWithValue` (default: `true`) - Determine media query match state on first render. Setting
 * this to false will make the hook yield `undefined` on first render.
 */
export function useMediaQuery(query: string, options?: UseMediaQueryOptions): boolean | undefined {
  function getInitialState() {
    if (options?.initializeWithValue ?? true) {
      let entry = queriesMap.get(query);
      if (!entry) {
        entry = createQueryEntry(query);
        queriesMap.set(query, entry);
      }
      return entry.mql.matches;
    }

    return undefined;
  }

  const [state, setState] = useState<boolean | undefined>(getInitialState());

  useEffect(() => {
    querySubscribe(query, setState);

    return () => queryUnsubscribe(query, setState);
  }, [query]);

  return state;
}

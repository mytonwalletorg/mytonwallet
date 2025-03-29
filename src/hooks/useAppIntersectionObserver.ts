import type { RefObject } from 'react';

import type { ObserveFn } from './useIntersectionObserver';

import { useIntersectionObserver, useIsIntersecting } from './useIntersectionObserver';

let observeIntersection: ObserveFn;

const THROTTLE = 350;

export function useAppIntersectionObserver() {
  const { observe } = useIntersectionObserver({
    throttleMs: THROTTLE,
  });

  observeIntersection = observe;
}

export function useIsIntersectingWithApp(targetRef: RefObject<HTMLElement>) {
  return useIsIntersecting(targetRef, observeIntersection);
}

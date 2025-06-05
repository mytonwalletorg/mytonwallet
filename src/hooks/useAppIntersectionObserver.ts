import type { ElementRef } from '../lib/teact/teact';

import type { ObserveFn } from './useIntersectionObserver';

import { useGetIsIntersecting, useIntersectionObserver } from './useIntersectionObserver';

let observeIntersection: ObserveFn;

const THROTTLE = 350;

export function useAppIntersectionObserver() {
  const { observe } = useIntersectionObserver({
    throttleMs: THROTTLE,
  });

  observeIntersection = observe;
}

export function useGetIsIntersectingWithApp(targetRef: ElementRef<HTMLElement>) {
  return useGetIsIntersecting(targetRef, observeIntersection);
}

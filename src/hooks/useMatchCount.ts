import { useRef } from '../lib/teact/teact';

export function useMatchCount(predicate: boolean, times: number): boolean {
  const countRef = useRef(0);
  const prevPredicateRef = useRef(false);

  if (!prevPredicateRef.current && predicate && countRef.current < times) {
    countRef.current += 1;
  }

  prevPredicateRef.current = predicate;

  return countRef.current >= times;
}

import type { ElementRef } from '../lib/teact/teact';
import { useEffect, useState } from '../lib/teact/teact';

interface OwnProps {
  rootMargin?: string;
  threshold?: number | number[];
  isDisabled?: boolean;
  targetRef: ElementRef;
}

export default function useScrollDetection(options: OwnProps) {
  const {
    rootMargin = '0px',
    threshold = [0],
    isDisabled,
    targetRef,
  } = options;

  const [isIntersecting, setIsIntersecting] = useState(true);

  useEffect(() => {
    if (isDisabled || !targetRef.current) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsIntersecting(entry.isIntersecting);
      },
      {
        rootMargin,
        threshold,
      },
    );

    observer.observe(targetRef.current);

    return () => {
      observer.disconnect();
    };
  }, [rootMargin, threshold, isDisabled, targetRef]);

  return { isIntersecting };
}

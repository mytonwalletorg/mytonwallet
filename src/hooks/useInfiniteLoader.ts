import { useRef, useState } from '../lib/teact/teact';

import useLastCallback from './useLastCallback';

interface OwnProps {
  loadMore: NoneToVoidFunction;
  isLoading?: boolean;
  isDisabled?: boolean;
}

export default function useInfiniteLoader({ isDisabled, isLoading, loadMore }: OwnProps) {
  const loadingObserver = useRef<IntersectionObserver>();
  const [hasIntersection, setHasIntersection] = useState(false);

  const handleIntersection = useLastCallback((node: HTMLElement | null) => {
    if (isLoading) {
      return;
    }

    if (loadingObserver.current) {
      setHasIntersection(false);
      loadingObserver.current.disconnect();
    }

    if (isDisabled || !node) {
      return;
    }

    loadingObserver.current = new IntersectionObserver((entries) => {
      const isIntersecting = entries.some((entry) => entry.isIntersecting);
      setHasIntersection(isIntersecting);
      if (isIntersecting) {
        loadMore();
      }
    });

    loadingObserver.current.observe(node);
  });

  return { handleIntersection, hasIntersection };
}

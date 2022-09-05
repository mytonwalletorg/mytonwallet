import { useCallback, useRef } from '../lib/teact/teact';

interface OwnProps {
  loadMore: NoneToVoidFunction;
  isLoading?: boolean;
  isDisabled?: boolean;
}

export default function useInfiniteLoader({ isDisabled, isLoading, loadMore }: OwnProps) {
  // eslint-disable-next-line no-null/no-null
  const loadingObserver = useRef<IntersectionObserver>(null);

  return useCallback((node: HTMLElement | null) => {
    if (isLoading) {
      return;
    }

    if (loadingObserver.current) {
      loadingObserver.current.disconnect();
    }

    if (isDisabled || !node) {
      return;
    }

    loadingObserver.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        loadMore();
      }
    });

    loadingObserver.current.observe(node);
  }, [isDisabled, isLoading, loadMore]);
}

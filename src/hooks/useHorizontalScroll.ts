import { type ElementRef, useEffect } from '../lib/teact/teact';

interface OwnProps {
  containerRef: ElementRef<HTMLDivElement>;
  isDisabled?: boolean;
  shouldPreventDefault?: boolean;
  contentSelector?: string;
}

function useHorizontalScroll({
  containerRef,
  isDisabled,
  shouldPreventDefault = false,
  contentSelector,
}: OwnProps) {
  useEffect(() => {
    const container = containerRef.current;

    if (isDisabled || !container) {
      return undefined;
    }

    function handleScroll(e: WheelEvent) {
      // Ignore horizontal scroll and let it work natively (e.g. on touchpad)
      if (!e.deltaX) {
        const content = contentSelector ? container!.querySelector(contentSelector) : container;
        if (!content) return;

        content.scrollLeft += e.deltaY / 4;
        if (shouldPreventDefault) e.preventDefault();
      }
    }

    container.addEventListener('wheel', handleScroll, { passive: !shouldPreventDefault });

    return () => {
      container.removeEventListener('wheel', handleScroll);
    };
  }, [containerRef, contentSelector, isDisabled, shouldPreventDefault]);
}

export default useHorizontalScroll;

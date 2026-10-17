import type { ElementRef } from '../lib/teact/teact';
import { useEffect } from '../lib/teact/teact';

export default function useHeightChange(
  ref: ElementRef<HTMLElement>,
  onChange: (prevHeight: number, nextHeight: number) => void,
) {
  useEffect(() => {
    let prevSize: ResizeObserverSize | undefined;

    const observer = new ResizeObserver(([entry]) => {
      const [size] = entry.borderBoxSize;
      // A width change comes from outside the content: a window resize, or a slide hidden with `display: none`
      if (prevSize && size.inlineSize === prevSize.inlineSize && size.blockSize !== prevSize.blockSize) {
        onChange(prevSize.blockSize, size.blockSize);
      }
      prevSize = size;
    });
    observer.observe(ref.current!);

    return () => observer.disconnect();
  }, [ref, onChange]);
}

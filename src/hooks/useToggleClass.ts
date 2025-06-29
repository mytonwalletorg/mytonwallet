import { useLayoutEffect } from '../lib/teact/teact';
import { addExtraClass, removeExtraClass } from '../lib/teact/teact-dom';

interface Options {
  className: string;
  isActive?: boolean;
  element?: HTMLElement | Document;
}

export default function useToggleClass({
  className,
  isActive,
  element = document.documentElement,
}: Options): void {
  useLayoutEffect(() => {
    if (!isActive) return;

    addExtraClass(element as HTMLElement, className);

    return () => {
      removeExtraClass(element as HTMLElement, className);
    };
  }, [className, isActive, element]);
}

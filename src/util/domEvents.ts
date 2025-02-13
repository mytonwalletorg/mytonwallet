import type React from '../lib/teact/teact';

export const stopEvent = (e: React.UIEvent | Event | React.FormEvent) => {
  e.stopPropagation();
  e.preventDefault();
};

export function listenOnce<T extends Event = Event>(
  target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>,
  name: string,
  handler: (event: T) => void,
) {
  const handleEvent = (event: Event) => {
    target.removeEventListener(name, handleEvent);
    handler(event as T);
  };
  target.addEventListener(name, handleEvent);
}

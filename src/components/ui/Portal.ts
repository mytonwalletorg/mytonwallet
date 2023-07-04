import type { VirtualElement } from '../../lib/teact/teact';
import { useLayoutEffect, useRef } from '../../lib/teact/teact';
import TeactDOM from '../../lib/teact/teact-dom';

type OwnProps = {
  containerId?: string;
  className?: string;
  style?: string;
  children: VirtualElement;
};

function Portal({
  containerId, className, style, children,
}: OwnProps): TeactJsx {
  const elementRef = useRef<HTMLDivElement>();
  if (!elementRef.current) {
    elementRef.current = document.createElement('div');
  }

  useLayoutEffect(() => {
    const container = document.querySelector<HTMLDivElement>(containerId || '#portals');
    if (!container) {
      return undefined;
    }

    const element = elementRef.current!;

    if (className) {
      element.className = className;
    }

    if (style) {
      element.style.cssText = style;
    }

    container.appendChild(element);

    return () => {
      TeactDOM.render(undefined, element);
      container.removeChild(element);
    };
  }, [className, style, containerId]);

  return TeactDOM.render(children, elementRef.current);
}

export default Portal;

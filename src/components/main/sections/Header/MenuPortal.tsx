import type { VirtualElement } from '../../../../lib/teact/teact';
import React, { useEffect, useState } from '../../../../lib/teact/teact';

import { useDeviceScreen } from '../../../../hooks/useDeviceScreen';

import Portal from '../../../ui/Portal';

interface Props {
  className?: string;
  containerRef: { current: HTMLElement | null };
  children: VirtualElement;
}

function MenuPortal({ className, containerRef, children }: Props) {
  const [style, setStyle] = useState<string | undefined>();
  const { isPortrait } = useDeviceScreen();

  useEffect(() => {
    function updateMenuPosition() {
      if (!containerRef.current) {
        return;
      }

      if (isPortrait) {
        setStyle(undefined);
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();

      setStyle(`top: ${rect.top + rect.height}px; left: ${rect.left + rect.width}px;`);
    }

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition);
    };
  }, [isPortrait, containerRef]);

  if (isPortrait) {
    return children;
  }

  return (
    <Portal className={className} style={style}>
      {children}
    </Portal>
  );
}

export default MenuPortal;

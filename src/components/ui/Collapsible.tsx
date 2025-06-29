import React, { memo, useRef, useState } from '../../lib/teact/teact';

import { requestMutation } from '../../lib/fasterdom/fasterdom';
import buildClassName from '../../util/buildClassName';

import usePrevious from '../../hooks/usePrevious';

import './Collapsible.scss';

const CLASSES = {
  collapsible: 'collapsible',
  shown: 'shown',
  open: 'open',
  content: 'content',
} as const;

interface OwnProps {
  children: TeactJsx;
  isShown: boolean;
}

const DELAY = 200;

function Collapsible({ children, isShown }: OwnProps) {
  const containerRef = useRef<HTMLDivElement>();
  const isOpenRef = useRef(isShown);
  const [shouldRender, setShouldRender] = useState(isShown);
  const prevIsShown = usePrevious(isShown);
  const hideTimeoutRef = useRef<number>();

  function toggleOpen() {
    if (!containerRef.current) return;
    containerRef.current.classList.toggle(CLASSES.open);
    isOpenRef.current = !isOpenRef.current;
  }

  if (prevIsShown !== undefined && prevIsShown !== isShown) {
    if (isShown && !isOpenRef.current) {
      setShouldRender(true);
      if (hideTimeoutRef.current) window.clearTimeout(hideTimeoutRef.current);
      setTimeout(() => requestMutation(toggleOpen), DELAY);
    } else {
      requestMutation(toggleOpen);
      hideTimeoutRef.current = window.setTimeout(() => {
        setShouldRender(false);
      }, DELAY);
    }
  }

  const render = <div className={CLASSES.content}>{children}</div>;

  return (
    <div
      ref={containerRef}
      className={buildClassName(CLASSES.collapsible, isShown && CLASSES.shown, isOpenRef.current && CLASSES.open)}
    >
      {shouldRender ? render : undefined}
    </div>
  );
}

export default memo(Collapsible);

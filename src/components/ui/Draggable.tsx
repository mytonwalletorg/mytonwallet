import type { RefObject } from 'react';
import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import styles from './Draggable.module.scss';

type TPoint = {
  x: number;
  y: number;
};

type Offset = {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
};

type DraggableState = {
  isDragging: boolean;
  origin: TPoint;
  translation: TPoint;
  width?: number;
  height?: number;
};

type OwnProps = {
  children: React.ReactNode;
  onDrag: (translation: TPoint, id: number | string) => void;
  onDragEnd: NoneToVoidFunction;
  id: number | string;
  style?: string;
  knobStyle?: string;
  isDisabled?: boolean;
  offset?: Offset;
  parentRef?: RefObject<HTMLDivElement>;
  className?: string;
  onClick: NoneToVoidFunction;
};

const ZERO_POINT: TPoint = { x: 0, y: 0 };

const DEFAULT_OFFSET: Offset = {
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
};

function Draggable({
  children,
  id,
  onDrag,
  onDragEnd,
  style: externalStyle,
  knobStyle,
  isDisabled,
  offset = DEFAULT_OFFSET,
  parentRef,
  className,
  onClick,
}: OwnProps) {
  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const buttonRef = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<DraggableState>({
    isDragging: false,
    origin: ZERO_POINT,
    translation: ZERO_POINT,
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    const { x, y } = getClientCoordinate(e);

    setState({
      ...state,
      isDragging: true,
      origin: { x, y },
      width: ref.current?.offsetWidth,
      height: ref.current?.offsetHeight,
    });
  };

  const handleTouchStart = useLastCallback((e: TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const { x, y } = getClientCoordinate(e);

    setState({
      ...state,
      isDragging: true,
      origin: { x, y },
      width: ref.current?.offsetWidth,
      height: ref.current?.offsetHeight,
    });
  });

  const handleMouseMove = useLastCallback((e: MouseEvent | TouchEvent) => {
    const { x, y } = getClientCoordinate(e);

    const translation = {
      x: x - state.origin.x,
      y: y - state.origin.y,
    };

    if (parentRef && parentRef?.current && ref.current) {
      const {
        top = 0, right = 0, bottom = 0, left = 0,
      } = offset;
      const parentRect = parentRef.current.getBoundingClientRect();
      const draggableRect = ref.current.getBoundingClientRect();

      const minX = -ref.current.offsetLeft + left;
      const maxX = parentRect.width - draggableRect.width - ref.current.offsetLeft + right;

      const minY = -ref.current.offsetTop + top;
      const maxY = parentRect.height - draggableRect.height - ref.current.offsetTop + bottom;

      translation.x = Math.max(minX, Math.min(translation.x, maxX));
      translation.y = Math.max(minY, Math.min(translation.y, maxY));
    }

    setState((current) => ({
      ...current,
      translation,
    }));

    onDrag(translation, id);
  });

  const handleMouseUp = useLastCallback(() => {
    setState((current) => ({
      ...current,
      isDragging: false,
      width: undefined,
      height: undefined,
    }));

    onDragEnd();
  });

  useEffect(() => {
    if (state.isDragging && isDisabled) {
      setState((current) => ({
        ...current,
        isDragging: false,
        width: undefined,
        height: undefined,
      }));
    }
  }, [isDisabled, state.isDragging]);

  const handleClick = useLastCallback(() => {
    if (state.isDragging) {
      return;
    }

    onClick();
  });

  useEffect(() => {
    const dragButtonRef = buttonRef.current;

    if (dragButtonRef) {
      dragButtonRef.addEventListener('touchstart', handleTouchStart, { passive: false });
    }

    if (state.isDragging) {
      window.addEventListener('touchmove', handleMouseMove);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('touchend', handleMouseUp);
      window.addEventListener('touchcancel', handleMouseUp);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
      window.removeEventListener('touchcancel', handleMouseUp);
      window.removeEventListener('mouseup', handleMouseUp);

      setState((current) => ({
        ...current,
        translation: ZERO_POINT,
      }));
    }

    return () => {
      if (state.isDragging) {
        window.removeEventListener('touchmove', handleMouseMove);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('touchend', handleMouseUp);
        window.removeEventListener('touchcancel', handleMouseUp);
        window.removeEventListener('mouseup', handleMouseUp);

        if (dragButtonRef) {
          dragButtonRef.removeEventListener('touchstart', handleTouchStart);
        }
      }
    };
  }, [handleMouseMove, handleMouseUp, handleTouchStart, state.isDragging, buttonRef]);

  const fullClassName = buildClassName(styles.container, className, state.isDragging && styles.isDragging);

  const cssStyles = useMemo(() => {
    return buildStyle(
      state.isDragging && `transform: translate(${state.translation.x}px, ${state.translation.y}px)`,
      state.width ? `width: ${state.width}px` : undefined,
      state.height ? `height: ${state.height}px` : undefined,
      externalStyle,
    );
  }, [externalStyle, state.height, state.isDragging, state.translation.x, state.translation.y, state.width]);

  return (
    <div style={cssStyles} className={fullClassName} ref={ref} onClick={handleClick}>
      {children}

      {!isDisabled && (
        <div
          ref={buttonRef}
          aria-label={lang('i18n_dragToSort')}
          tabIndex={0}
          role="button"
          className={buildClassName(styles.knob, 'div-button', 'draggable-knob')}
          onMouseDown={handleMouseDown}
          style={knobStyle}
        >
          <i className="icon icon-sort" aria-hidden />
        </div>
      )}
    </div>
  );
}

export default memo(Draggable);

function getClientCoordinate(e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) {
  let x;
  let y;

  if ('touches' in e) {
    x = e.touches[0].clientX;
    y = e.touches[0].clientY;
  } else {
    x = e.clientX;
    y = e.clientY;
  }

  return { x, y };
}

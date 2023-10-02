import { IS_IOS } from './windowEnvironment';
import windowSize from './windowSize';

export enum SwipeDirection {
  Up,
  Down,
  Left,
  Right,
}

// https://stackoverflow.com/questions/11287877/how-can-i-get-e-offsetx-on-mobile-ipad
// Android does not have this value, and iOS has it but as read-only
export interface RealTouchEvent extends TouchEvent {
  pageX?: number;
  pageY?: number;
}

type TSwipeAxis =
  'x'
  | 'y'
  | undefined;

export const IOS_SCREEN_EDGE_THRESHOLD = 20;
const SWIPE_THRESHOLD = 50;

export function captureSwipe(element: HTMLElement, handleSwipe: (e: Event, direction: SwipeDirection) => boolean) {
  let captureEvent: MouseEvent | RealTouchEvent | undefined;
  let hasSwiped = false;
  let initialSwipeAxis: TSwipeAxis | undefined;

  function onCapture(e: MouseEvent | RealTouchEvent) {
    captureEvent = e;

    if (e.type === 'touchstart') {
      // We need to always listen on `touchstart` target:
      // https://stackoverflow.com/questions/33298828/touch-move-event-dont-fire-after-touch-start-target-is-removed
      const target = e.target as HTMLElement;
      target.addEventListener('touchmove', onMove, { passive: true });
      target.addEventListener('touchend', onRelease);
      target.addEventListener('touchcancel', onRelease);

      if ('touches' in e) {
        if (e.pageX === undefined) {
          e.pageX = e.touches[0].pageX;
        }

        if (e.pageY === undefined) {
          e.pageY = e.touches[0].pageY;
        }
      }
    }
  }

  function onRelease() {
    if (captureEvent) {
      (captureEvent.target as HTMLElement).removeEventListener('touchcancel', onRelease);
      (captureEvent.target as HTMLElement).removeEventListener('touchend', onRelease);
      (captureEvent.target as HTMLElement).removeEventListener('touchmove', onMove);
    }

    hasSwiped = false;
    initialSwipeAxis = undefined;
    captureEvent = undefined;
  }

  function onMove(e: MouseEvent | RealTouchEvent) {
    if (captureEvent) {
      if (e.type === 'touchmove' && ('touches' in e)) {
        if (e.pageX === undefined) {
          e.pageX = e.touches[0].pageX;
        }

        if (e.pageY === undefined) {
          e.pageY = e.touches[0].pageY;
        }
      }

      const dragOffsetX = e.pageX! - captureEvent.pageX!;
      const dragOffsetY = e.pageY! - captureEvent.pageY!;

      if (!hasSwiped) {
        hasSwiped = onSwipe(e, dragOffsetX, dragOffsetY);
      }
    }
  }

  function onSwipe(e: MouseEvent | RealTouchEvent, dragOffsetX: number, dragOffsetY: number) {
    // Avoid conflicts with swipe-to-back gestures
    if (IS_IOS) {
      const x = (e as RealTouchEvent).touches[0].pageX;
      if (x <= IOS_SCREEN_EDGE_THRESHOLD || x >= windowSize.get().width - IOS_SCREEN_EDGE_THRESHOLD) {
        return false;
      }
    }

    const xAbs = Math.abs(dragOffsetX);
    const yAbs = Math.abs(dragOffsetY);

    if (dragOffsetX && dragOffsetY) {
      const ratio = Math.max(xAbs, yAbs) / Math.min(xAbs, yAbs);
      // Diagonal swipe
      if (ratio < 2) {
        return false;
      }
    }

    let axis: TSwipeAxis | undefined;
    if (xAbs >= SWIPE_THRESHOLD) {
      axis = 'x';
    } else if (yAbs >= SWIPE_THRESHOLD) {
      axis = 'y';
    }

    if (!axis) {
      return false;
    }

    if (!initialSwipeAxis) {
      initialSwipeAxis = axis;
    } else if (initialSwipeAxis !== axis) {
      // Prevent horizontal swipe after vertical to prioritize scroll
      return false;
    }

    return processSwipe(e, axis, dragOffsetX, dragOffsetY, handleSwipe);
  }

  element.addEventListener('touchstart', onCapture, { passive: true });

  return () => {
    onRelease();
    element.removeEventListener('touchstart', onCapture);
  };
}

function processSwipe(
  e: Event,
  currentSwipeAxis: TSwipeAxis,
  dragOffsetX: number,
  dragOffsetY: number,
  onSwipe: (e: Event, direction: SwipeDirection) => boolean,
) {
  if (currentSwipeAxis === 'x') {
    if (dragOffsetX < 0) {
      return onSwipe(e, SwipeDirection.Left);
    } else {
      return onSwipe(e, SwipeDirection.Right);
    }
  } else if (currentSwipeAxis === 'y') {
    if (dragOffsetY < 0) {
      return onSwipe(e, SwipeDirection.Up);
    } else {
      return onSwipe(e, SwipeDirection.Down);
    }
  }

  return false;
}

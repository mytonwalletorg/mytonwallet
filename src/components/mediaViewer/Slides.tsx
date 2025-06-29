import React, {
  memo, useEffect, useLayoutEffect, useRef, useState,
} from '../../lib/teact/teact';

import type { RealTouchEvent } from '../../util/captureEvents';

import { animateNumber, timingFunctions } from '../../util/animation';
import buildClassName from '../../util/buildClassName';
import {
  captureEvents,
  IOS_SCREEN_EDGE_THRESHOLD,
  SWIPE_DIRECTION_THRESHOLD,
  SWIPE_DIRECTION_TOLERANCE,
} from '../../util/captureEvents';
import { clamp, isBetween, round } from '../../util/math';
import { debounce } from '../../util/schedulers';
import { IS_IOS, IS_TOUCH_ENV } from '../../util/windowEnvironment';

import useDebouncedCallback from '../../hooks/useDebouncedCallback';
import useDerivedState from '../../hooks/useDerivedState';
import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useSignal from '../../hooks/useSignal';
import { useSignalRef } from '../../hooks/useSignalRef';
import useWindowSize from '../../hooks/useWindowSize';
import useZoomChange from './hooks/useZoomChangeSignal';

import Media from './Media';

import styles from './MediaViewer.module.scss';

interface OwnProps {
  isOpen: boolean;
  mediaId?: string;
  getMediaId: (fromId?: string, direction?: number) => string | undefined;
  selectMedia: (id: string) => void;
  withAnimation: boolean;
  onClose: () => void;
}

type Transform = {
  x: number;
  y: number;
  scale: number;
};

enum SwipeDirection {
  Horizontal,
  Vertical,
}

const SWIPE_X_THRESHOLD = 50; // px
const SWIPE_Y_THRESHOLD = 50; // px
const SLIDES_GAP = IS_TOUCH_ENV ? 40 : 0; // px
const ANIMATION_DURATION = 350; // ms
const DEBOUNCE_SELECT_MEDIA = 350; // ms
const DEBOUNCE_SWIPE = 500; // ms
const DOUBLE_TAP_ZOOM = 3;
const CLICK_Y_THRESHOLD = 80; // px
const MAX_ZOOM = 4;
const MIN_ZOOM = 1;

const { easeOutCubic, easeOutQuart } = timingFunctions;

let cancelAnimation: ReturnType<typeof animateNumber> | undefined;
let cancelZoomAnimation: ReturnType<typeof animateNumber> | undefined;

function Slides({
  isOpen, mediaId, selectMedia, getMediaId, withAnimation, onClose,
}: OwnProps) {
  const lang = useLang();

  const containerRef = useRef<HTMLDivElement>();
  const activeSlideRef = useRef<HTMLDivElement>();
  const leftSlideRef = useRef<HTMLDivElement>();
  const rightSlideRef = useRef<HTMLDivElement>();
  const lastTransformRef = useRef<Transform>({ x: 0, y: 0, scale: 1 });
  const swipeDirectionRef = useRef<SwipeDirection | undefined>(undefined);
  const initialContentRectRef = useRef<DOMRect | undefined>(undefined);
  const isReleasedRef = useRef(false);
  const [getZoomChange] = useZoomChange();
  const prevZoomChangeRef = useRef(getZoomChange());
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [getTransform, setTransform] = useSignal<Transform>({ x: 0, y: 0, scale: 1 });
  const transformRef = useSignalRef(getTransform);
  const [getActiveMediaId, setActiveMediaId] = useSignal<string | undefined>(mediaId);
  const activeMediaIdRef = useSignalRef(getActiveMediaId);
  const isScaled = useDerivedState(() => getTransform().scale !== 1, [getTransform]);
  const activeMediaId = useDerivedState(getActiveMediaId);
  const { height: windowHeight, width: windowWidth, isResizing } = useWindowSize();

  useHistoryBack({
    isActive: isOpen,
    onBack: onClose,
    shouldBeReplaced: true,
  });

  const selectMediaDebounced = useDebouncedCallback(selectMedia, [selectMedia], DEBOUNCE_SELECT_MEDIA, true);
  const clearSwipeDirectionDebounced = useDebouncedCallback(() => {
    swipeDirectionRef.current = undefined;
  }, [], DEBOUNCE_SWIPE, true);

  const clickXThreshold = IS_TOUCH_ENV ? 40 : windowWidth / 10;

  useEffect(() => {
    const { scale, x, y } = transformRef.current;
    // Only update active media if slide is in default position
    if (x === 0 && y === 0 && scale === 1) {
      setActiveMediaId(mediaId);
    }
  }, [mediaId, setActiveMediaId, transformRef]);

  useLayoutEffect(() => {
    const { x, y, scale } = getTransform();
    if (leftSlideRef.current) {
      leftSlideRef.current.style.transform = getTransformStyle(-windowWidth + x - SLIDES_GAP);
    }
    if (activeSlideRef.current) {
      activeSlideRef.current.style.transform = getTransformStyle(x, y, scale);
    }
    if (rightSlideRef.current) {
      rightSlideRef.current.style.transform = getTransformStyle(windowWidth + x + SLIDES_GAP);
    }
  }, [getTransform, windowWidth]);

  const changeSlide = useLastCallback((direction: number, dryRun = false) => {
    let lastTransform = lastTransformRef.current;
    const mId = getMediaId(activeMediaIdRef.current, direction);
    if (dryRun) return mId !== undefined;
    if (mId === undefined) return false;
    const offset = (windowWidth + SLIDES_GAP) * direction;
    const transform = transformRef.current;
    const x = transform.x + offset;
    setActiveMediaId(mId);
    selectMediaDebounced(mId);
    lastTransform = { x: 0, y: 0, scale: 1 };
    if (!withAnimation) {
      setTransform(lastTransform);
      return true;
    }
    cancelAnimation = animateNumber({
      from: x,
      to: 0,
      duration: ANIMATION_DURATION,
      timing: easeOutCubic,
      onUpdate: (value) => setTransform({
        y: 0,
        x: value,
        scale: 1,
      }),
    });
    return true;
  });

  const handleNextSlide = useLastCallback(() => changeSlide(1));
  const handlePrevSlide = useLastCallback(() => changeSlide(-1));

  useEffect(() => {
    if (!containerRef.current || activeMediaIdRef.current === undefined) {
      return undefined;
    }
    let lastTransform = lastTransformRef.current;
    const lastDragOffset = {
      x: 0,
      y: 0,
    };
    const lastZoomCenter = {
      x: 0,
      y: 0,
    };
    const panDelta = {
      x: 0,
      y: 0,
    };
    let lastGestureTime = Date.now();
    let content: HTMLElement | null;
    const setLastGestureTime = debounce(() => {
      lastGestureTime = Date.now();
    }, 500, false, true);

    const changeSlideOnClick = (e: MouseEvent): [boolean, boolean] => {
      const { scale } = transformRef.current;
      if (scale !== 1) return [false, false];
      let direction = 0;
      if (windowHeight - e.pageY < CLICK_Y_THRESHOLD) {
        return [false, false];
      }
      if (e.pageX < clickXThreshold) {
        direction = -1;
      } else if (e.pageX > windowWidth - clickXThreshold) {
        direction = 1;
      }
      const hasNextSlide = changeSlide(direction, !IS_TOUCH_ENV);
      const isInThreshold = direction !== 0;
      return [isInThreshold, hasNextSlide];
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const { scale } = transformRef.current;
      if (scale !== 1) return;
      switch (e.key) {
        case 'Left': // IE/Edge specific value
        case 'ArrowLeft':
          changeSlide(-1);
          break;

        case 'Right': // IE/Edge specific value
        case 'ArrowRight':
          changeSlide(1);
          break;
      }
    };

    const calculateOffsetBoundaries = (
      { x, y, scale }: Transform,
      offsetTop = 0,
    ): [Transform, boolean, boolean] => {
      const initialContentRect = initialContentRectRef.current;
      if (!initialContentRect) return [{ x, y, scale }, true, true];
      // Get current content boundaries
      let inBoundsX = true;
      let inBoundsY = true;

      const centerX = (windowWidth - windowWidth * scale) / 2;
      const centerY = (windowHeight - windowHeight * scale) / 2;

      // If content is outside window we calculate offset boundaries
      // based on initial content rect and current scale
      const minOffsetX = Math.max(-initialContentRect.left * scale, centerX);
      const maxOffsetX = windowWidth - initialContentRect.right * scale;
      inBoundsX = isBetween(x, maxOffsetX, minOffsetX);
      x = clamp(x, maxOffsetX, minOffsetX);

      const minOffsetY = Math.max(-initialContentRect.top * scale + offsetTop, centerY);
      const maxOffsetY = windowHeight - initialContentRect.bottom * scale;
      inBoundsY = isBetween(y, maxOffsetY, minOffsetY);
      y = clamp(y, maxOffsetY, minOffsetY);

      return [{ x, y, scale }, inBoundsX, inBoundsY];
    };

    const onRelease = (e: MouseEvent | RealTouchEvent | WheelEvent) => {
      // This allows to prevent onRelease triggered by debounced wheel event
      // after onRelease was triggered manually in onDrag
      if (isReleasedRef.current) {
        isReleasedRef.current = false;
        return;
      }
      if (e.type === 'mouseup') {
        setIsMouseDown(false);
      }
      const transform = transformRef.current;
      const { y, scale } = transform;
      let x = transform.x;
      const absX = Math.abs(x);
      const absY = Math.abs(y);

      clearSwipeDirectionDebounced();

      // If scale is less than 1 we need to bounce back
      if (scale < 1) {
        lastTransform = { x: 0, y: 0, scale: 1 };
        cancelAnimation = animateNumber({
          from: [x, y, scale],
          to: [0, 0, 1],
          duration: ANIMATION_DURATION,
          timing: easeOutCubic,
          onUpdate: (value) => setTransform({
            x: value[0],
            y: value[1],
            scale: value[2],
          }),
        });
        return;
      }
      if (scale > 1) {
        // Get current content boundaries
        const s1 = Math.min(scale, MAX_ZOOM);
        const scaleFactor = s1 / scale;

        // Calculate new position based on the last zoom center to keep the zoom center
        // at the same position when bouncing back from max zoom
        let x1 = x * scaleFactor + (lastZoomCenter.x - scaleFactor * lastZoomCenter.x);
        let y1 = y * scaleFactor + (lastZoomCenter.y - scaleFactor * lastZoomCenter.y);

        // Arbitrary pan velocity coefficient
        const k = 0.15;

        // If scale didn't change, we need to add inertia to pan gesture
        if (e.type !== 'wheel' && lastTransform.scale === scale) {
          // Calculate user gesture velocity
          const Vx = Math.abs(lastDragOffset.x) / (Date.now() - lastGestureTime);
          const Vy = Math.abs(lastDragOffset.y) / (Date.now() - lastGestureTime);

          // Add extra distance based on gesture velocity and last pan delta
          x1 -= Math.abs(lastDragOffset.x) * Vx * k * panDelta.x;
          y1 -= Math.abs(lastDragOffset.y) * Vy * k * panDelta.y;
        }

        [lastTransform] = calculateOffsetBoundaries({ x: x1, y: y1, scale: s1 });
        cancelAnimation = animateNumber({
          from: [x, y, scale],
          to: [lastTransform.x, lastTransform.y, lastTransform.scale],
          duration: ANIMATION_DURATION,
          timing: easeOutCubic,
          onUpdate: (value) => setTransform({
            x: value[0],
            y: value[1],
            scale: value[2],
          }),
        });
        return;
      }
      lastTransform = {
        x,
        y,
        scale,
      };
      if (absY >= SWIPE_Y_THRESHOLD) {
        onClose();
        return;
      }
      // Bounce back if vertical swipe is below threshold
      if (absY > 0) {
        cancelAnimation = animateNumber({
          from: y,
          to: 0,
          duration: ANIMATION_DURATION,
          timing: easeOutCubic,
          onUpdate: (value) => setTransform({
            x: 0,
            y: value,
            scale,
          }),
        });
        return;
      }
      // Get horizontal swipe direction
      const direction = x < 0 ? 1 : -1;
      const mId = getMediaId(activeMediaIdRef.current, x < 0 ? 1 : -1);
      // Get the direction of the last pan gesture.
      // Could be different from the total horizontal swipe direction
      // if user starts a swipe in one direction and then changes the direction
      // we need to cancel slide transition
      const dirX = panDelta.x < 0 ? -1 : 1;
      if (mId !== undefined && absX >= SWIPE_X_THRESHOLD && direction === dirX) {
        const offset = (windowWidth + SLIDES_GAP) * direction;
        // If image is shifted by more than SWIPE_X_THRESHOLD,
        // We shift everything by one screen width and then set new active message id
        x += offset;
        setActiveMediaId(mId);
        selectMediaDebounced(mId);
      }
      // Then we always return to the original position
      cancelAnimation = animateNumber({
        from: x,
        to: 0,
        duration: ANIMATION_DURATION,
        timing: easeOutCubic,
        onUpdate: (value) => setTransform({
          y: 0,
          x: value,
          scale: scale ?? 1,
        }),
      });
    };

    const cleanup = captureEvents(containerRef.current, {
      isNotPassive: true,
      withNativeDrag: true,
      excludedClosestSelector: `${styles.header}, .${styles.contentDescription}`,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      doubleTapZoom: DOUBLE_TAP_ZOOM,
      withWheelDrag: true,
      onCapture: (e) => {
        const { x, y, scale } = transformRef.current;
        if (e.type === 'mousedown') {
          setIsMouseDown(true);
          if (scale !== 1) {
            e.preventDefault();
            return;
          }
        }
        lastGestureTime = Date.now();
        if (x === 0 && y === 0 && scale === 1) {
          if (!activeSlideRef.current) return;
          content = activeSlideRef.current.querySelector('img, video');
          if (!content) return;
          // Store initial content rect, without transformations
          initialContentRectRef.current = content.getBoundingClientRect();
        }
      },
      onDrag: (event, captureEvent, {
        dragOffsetX,
        dragOffsetY,
      }, cancelDrag) => {
        if (isReleasedRef.current) return;
        // Avoid conflicts with swipe-to-back gestures
        if (IS_IOS && captureEvent.type === 'touchstart') {
          const { pageX } = (captureEvent as RealTouchEvent).touches[0];
          if (pageX <= IOS_SCREEN_EDGE_THRESHOLD || pageX >= windowWidth - IOS_SCREEN_EDGE_THRESHOLD) {
            return;
          }
        }
        if (cancelAnimation) {
          cancelAnimation();
          cancelAnimation = undefined;
        }
        panDelta.x = lastDragOffset.x - dragOffsetX;
        panDelta.y = lastDragOffset.y - dragOffsetY;
        lastDragOffset.x = dragOffsetX;
        lastDragOffset.y = dragOffsetY;
        const absOffsetX = Math.abs(dragOffsetX);
        const absOffsetY = Math.abs(dragOffsetY);
        const { x, y, scale } = transformRef.current;

        // If user is inactive but is still touching the screen
        // we reset last gesture time
        setLastGestureTime();

        // If image is scaled we just need to pan it
        if (scale !== 1) {
          const x1 = lastTransform.x + dragOffsetX;
          const y1 = lastTransform.y + dragOffsetY;
          if (['wheel', 'mousemove'].includes(event.type)) {
            const [transform, inBoundsX, inBoundsY] = calculateOffsetBoundaries({ x: x1, y: y1, scale });
            if (cancelDrag) cancelDrag(!inBoundsX, !inBoundsY);
            setTransform(transform);
            return;
          }
          if ('touches' in event && event.touches.length === 1) {
            setTransform({
              x: x1,
              y: y1,
              scale,
            });
          }
          return;
        }
        if (event.type === 'mousemove') return;
        if (swipeDirectionRef.current !== SwipeDirection.Vertical) {
          // If user is swiping horizontally or horizontal shift is dominant
          // we change only horizontal position
          if (swipeDirectionRef.current === SwipeDirection.Horizontal
            || Math.abs(x) > SWIPE_DIRECTION_THRESHOLD || absOffsetX / absOffsetY > SWIPE_DIRECTION_TOLERANCE) {
            swipeDirectionRef.current = SwipeDirection.Horizontal;
            const limit = windowWidth + SLIDES_GAP;
            const x1 = clamp(dragOffsetX, -limit, limit);
            setTransform({
              x: x1,
              y: 0,
              scale,
            });
            // We know that at this point onRelease will trigger slide change,
            // We can trigger onRelease directly instead of waiting for the debounced callback
            // to avoid a delay
            if (event.type === 'wheel' && Math.abs(x1) > SWIPE_X_THRESHOLD * 2) {
              onRelease(event);
              isReleasedRef.current = true;
            }
            return;
          }
        }
        // If vertical shift is dominant we change only vertical position
        if (swipeDirectionRef.current === SwipeDirection.Vertical
          || Math.abs(y) > SWIPE_DIRECTION_THRESHOLD || absOffsetY / absOffsetX > SWIPE_DIRECTION_TOLERANCE) {
          swipeDirectionRef.current = SwipeDirection.Vertical;
          const limit = windowHeight;
          const y1 = clamp(dragOffsetY, -limit, limit);
          setTransform({
            x: 0,
            y: y1,
            scale,
          });
          if (event.type === 'wheel' && Math.abs(y1) > SWIPE_Y_THRESHOLD * 2) {
            onRelease(event);
            isReleasedRef.current = true;
          }
        }
      },
      onZoom: (e, {
        zoom,
        zoomFactor,
        initialCenterX,
        initialCenterY,
        dragOffsetX,
        dragOffsetY,
        currentCenterX,
        currentCenterY,
      }) => {
        if (cancelAnimation) cancelAnimation();
        initialCenterX = initialCenterX || windowWidth / 2;
        initialCenterY = initialCenterY || windowHeight / 2;
        currentCenterX = currentCenterX || windowWidth / 2;
        currentCenterY = currentCenterY || windowHeight / 2;

        // Calculate current scale based on zoom factor and limits, add zoom margin for bounce back effect
        const scale = zoom ?? clamp(lastTransform.scale * zoomFactor!, MIN_ZOOM * 0.5, MAX_ZOOM * 3);
        const scaleFactor = scale / lastTransform.scale;
        const offsetX = Math.abs(Math.min(lastTransform.x, 0));
        const offsetY = Math.abs(Math.min(lastTransform.y, 0));

        // Save last zoom center for bounce back effect
        lastZoomCenter.x = currentCenterX;
        lastZoomCenter.y = currentCenterY;

        // Calculate new center relative to the shifted image
        const scaledCenterX = offsetX + initialCenterX;
        const scaledCenterY = offsetY + initialCenterY;

        // Calculate how much we need to shift the image to keep the zoom center at the same position
        const scaleOffsetX = (scaledCenterX - scaleFactor * scaledCenterX);
        const scaleOffsetY = (scaledCenterY - scaleFactor * scaledCenterY);

        const [transform] = calculateOffsetBoundaries({
          x: lastTransform.x + scaleOffsetX + dragOffsetX,
          y: lastTransform.y + scaleOffsetY + dragOffsetY,
          scale,
        });

        setTransform(transform);
      },
      onClick(e) {
        setIsMouseDown(false);
        const [isInThreshold, hasNextSlide] = changeSlideOnClick(e as MouseEvent);
        if (isInThreshold) {
          e.preventDefault();
          e.stopPropagation();
          if (IS_TOUCH_ENV) return;
          if (!hasNextSlide) onClose();
          return;
        }
        if (lastTransform.scale !== 1 || IS_TOUCH_ENV) return;
        onClose();
      },
      onDoubleClick(e, {
        centerX,
        centerY,
      }) {
        const [isInThreshold] = changeSlideOnClick(e as MouseEvent);
        if (isInThreshold) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (!IS_TOUCH_ENV && e.type !== 'wheel') return;
        const { x, y, scale } = transformRef.current;
        // Calculate how much we need to shift the image to keep the zoom center at the same position
        const scaleOffsetX = (centerX - DOUBLE_TAP_ZOOM * centerX);
        const scaleOffsetY = (centerY - DOUBLE_TAP_ZOOM * centerY);
        if (scale === 1) {
          if (x !== 0 || y !== 0) return;
          lastTransform = calculateOffsetBoundaries({
            x: scaleOffsetX,
            y: scaleOffsetY,
            scale: DOUBLE_TAP_ZOOM,
          })[0];
        } else {
          lastTransform = {
            x: 0,
            y: 0,
            scale: 1,
          };
        }
        cancelAnimation = animateNumber({
          from: [x, y, scale],
          to: [lastTransform.x, lastTransform.y, lastTransform.scale],
          duration: ANIMATION_DURATION,
          timing: easeOutCubic,
          onUpdate: (value) => {
            const transform = {
              x: value[0],
              y: value[1],
              scale: value[2],
            };
            setTransform(transform);
          },
        });
      },
      onRelease,
    });
    document.addEventListener('keydown', handleKeyDown, false);
    return () => {
      cleanup();
      document.removeEventListener('keydown', handleKeyDown, false);
    };
  },
  [
    onClose,
    setTransform,
    getMediaId,
    windowWidth,
    windowHeight,
    clickXThreshold,
    selectMediaDebounced,
    clearSwipeDirectionDebounced,
    withAnimation,
    setIsMouseDown,
    transformRef,
    setActiveMediaId,
    activeMediaIdRef,
    changeSlide,
  ]);

  useEffect(() => {
    const zoomChange = getZoomChange();
    const hasZoomChanged = prevZoomChangeRef.current !== undefined
      && prevZoomChangeRef.current !== zoomChange;
    if (!containerRef.current || !hasZoomChanged) return;
    prevZoomChangeRef.current = zoomChange;
    const { scale } = transformRef.current;
    const dir = zoomChange > 0 ? -1 : +1;
    const minZoom = MIN_ZOOM * 0.6;
    const maxZoom = MAX_ZOOM * 3;
    let steps = 100;
    let prevValue = 0;
    if (scale <= minZoom && dir > 0) return;
    if (scale >= maxZoom && dir < 0) return;
    if (scale === 1 && dir > 0) steps = 20;
    if (cancelZoomAnimation) cancelZoomAnimation();
    cancelZoomAnimation = animateNumber({
      from: dir,
      to: dir * steps,
      duration: ANIMATION_DURATION,
      timing: easeOutQuart,
      onUpdate: (value) => {
        if (!containerRef.current) return;
        const delta = round(value - prevValue, 2);
        prevValue = value;
        // To reuse existing logic we trigger wheel event for zoom buttons
        const wheelEvent = new WheelEvent('wheel', {
          deltaY: delta,
          ctrlKey: true,
        });
        containerRef.current.dispatchEvent(wheelEvent);
      },
    });
  }, [getZoomChange, transformRef]);

  // eslint-disable-next-line no-null/no-null
  if (activeMediaId === undefined) return null;

  const nextMediaId = getMediaId(activeMediaId, 1);
  const prevMediaId = getMediaId(activeMediaId, -1);
  const hasPrev = prevMediaId !== undefined;
  const hasNext = nextMediaId !== undefined;
  const isMoving = isMouseDown && isScaled;

  return (
    <div className={styles.slides} ref={containerRef}>
      <div className={styles.slide} ref={leftSlideRef}>
        {hasPrev && !isScaled && !isResizing && (
          <Media mediaId={prevMediaId} />
        )}
      </div>
      <div
        className={buildClassName(styles.slide, styles.slide_active, isMoving && styles.slide_moving)}
        ref={activeSlideRef}
      >
        <Media mediaId={activeMediaId} />
      </div>
      <div className={styles.slide} ref={rightSlideRef}>
        {hasNext && !isScaled && !isResizing && (
          <Media mediaId={nextMediaId} />
        )}
      </div>
      {hasPrev && !isScaled && !IS_TOUCH_ENV && (
        <button
          type="button"
          onClick={handlePrevSlide}
          className={buildClassName(styles.navigation, styles.navigation_prev)}
          aria-label={lang('Previous')}
          dir={lang.isRtl ? 'rtl' : undefined}
        />
      )}
      {hasNext && !isScaled && !IS_TOUCH_ENV && (
        <button
          type="button"
          onClick={handleNextSlide}
          className={buildClassName(styles.navigation, styles.navigation_next)}
          aria-label={lang('Next')}
          dir={lang.isRtl ? 'rtl' : undefined}
        />
      )}
    </div>
  );
}

export default memo(Slides);

function getTransformStyle(x = 0, y = 0, scale = 1) {
  return `translate3d(${x.toFixed(3)}px, ${y.toFixed(3)}px, 0px) scale(${scale.toFixed(3)})`;
}

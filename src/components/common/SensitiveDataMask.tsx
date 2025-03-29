import React, { memo, useLayoutEffect, useRef } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { Theme } from '../../global/types';

import { requestMutation } from '../../lib/fasterdom/fasterdom';
import { animateInstantly } from '../../util/animation';
import buildClassName from '../../util/buildClassName';
import { clamp } from '../../util/math';
import { random } from '../../util/random';
import { DPR } from '../../util/windowEnvironment';

import { useIsIntersectingWithApp } from '../../hooks/useAppIntersectionObserver';
import useAppTheme from '../../hooks/useAppTheme';
import { isBackgroundModeActive } from '../../hooks/useBackgroundMode';
import { useStateRef } from '../../hooks/useStateRef';

import styles from './SensitiveDataMask.module.scss';

export type SensitiveDataMaskSkin = (
  'lightTheme' | 'darkTheme' | 'cardLightText' | 'cardDarkText' | 'cardGoldText' | 'purple'
  );

interface OwnProps {
  cols: number;
  rows: number;
  cellSize: number;
  skin?: SensitiveDataMaskSkin;
  className?: string;
}

interface StateProps {
  theme: Theme;
}

// STEPS values are pre-multiplied by 1 / (1000 / 60) to compensate for FPS
const STEPS = [
  0.0001 * 0.06,
  0.0001 * 0.06,
  0.00001 * 0.06,
  0.0003 * 0.06,
  0.0001 * 0.06,
  0.0025 * 0.06,
];
const FROM = 0.07;
const TO = 0.25;
const CHANGE_SPEED_INTERVAL = 3000;
const SKIN_COLORS: Record<SensitiveDataMaskSkin, string> = {
  lightTheme: '120, 121, 122',
  darkTheme: '240, 241, 242',
  cardLightText: '250, 250, 250',
  cardDarkText: '10, 10, 10',
  cardGoldText: '101, 73, 16',
  purple: '96, 107, 215',
};

function SensitiveDataMask({
  cols,
  rows,
  cellSize,
  skin,
  className,
  theme,
}: OwnProps & StateProps) {
  // eslint-disable-next-line no-null/no-null
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cellSizeDpr = cellSize * DPR;

  const appTheme = useAppTheme(theme);
  const color = SKIN_COLORS[skin ?? `${appTheme}Theme`];

  const isIntersectingRef = useStateRef(useIsIntersectingWithApp(canvasRef));

  useLayoutEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    const width = cols * cellSizeDpr;
    const height = rows * cellSizeDpr;

    const opacityInitials: number[][] = [];
    const steps: number[][] = [];

    let lastFrameAt: number | undefined;
    let lastSpeedChangeAt: number | undefined;

    let shouldAnimate = true;
    let isRendered = false;

    canvas.width = width;
    canvas.height = height;

    function renderFrame(frameDuration = 0) {
      const now = performance.now();
      const shouldChangeSpeed = lastSpeedChangeAt ? now - lastSpeedChangeAt >= CHANGE_SPEED_INTERVAL : false;

      if (shouldChangeSpeed || !lastSpeedChangeAt) {
        lastSpeedChangeAt = now;
      }

      ctx.clearRect(0, 0, width, height);

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          steps[row] ??= [];
          opacityInitials[row] ??= [];

          if (shouldChangeSpeed) {
            steps[row][col] = sample(STEPS) * (steps[row][col] < 0 ? -1 : 1);
          } else {
            steps[row][col] ??= sample(STEPS);
          }

          let nextOpacity = opacityInitials[row][col] ?? (Math.random() * (TO - FROM) + FROM);
          nextOpacity += steps[row][col] * frameDuration;
          if (nextOpacity > TO || nextOpacity < FROM) {
            steps[row][col] *= -1;
            nextOpacity = clamp(nextOpacity, FROM, TO);
          }

          opacityInitials[row][col] = nextOpacity;

          ctx.fillStyle = `rgba(${color}, ${nextOpacity})`;
          ctx.fillRect(col * cellSizeDpr, row * cellSizeDpr, cellSizeDpr, cellSizeDpr);

          isRendered ||= true;
        }
      }
    }

    animateInstantly(() => {
      if (!shouldAnimate) return false;

      if (isRendered && (!isIntersectingRef.current || isBackgroundModeActive())) {
        lastFrameAt = undefined;
        lastSpeedChangeAt = undefined;
        return true;
      }

      const now = performance.now();
      renderFrame(lastFrameAt ? now - lastFrameAt : 0);
      lastFrameAt = now;

      return true;
    }, requestMutation);

    return () => {
      shouldAnimate = false;
    };
  }, [cellSizeDpr, color, cols, rows, isIntersectingRef]);

  return (
    <canvas
      ref={canvasRef}
      style={`width: ${cellSize * cols}px; height: ${cellSize * rows}px`}
      className={buildClassName(styles.canvas, className)}
    />
  );
}

// Returns a random element from the array
function sample<T>(array: T[]): T {
  return array[random(0, array.length - 1)];
}

export default memo(withGlobal((global) => {
  return {
    theme: global.settings.theme,
  };
})(SensitiveDataMask));

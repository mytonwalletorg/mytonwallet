import React, { memo, useRef } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import { requestMeasure } from '../../lib/fasterdom/fasterdom';

import { useDeviceScreen } from '../../hooks/useDeviceScreen';
import useForceUpdate from '../../hooks/useForceUpdate';
import useLastCallback from '../../hooks/useLastCallback';
import useSyncEffect from '../../hooks/useSyncEffect';
import useWindowSize from '../../hooks/useWindowSize';

import styles from './ConfettiContainer.module.scss';

type StateProps = {
  lastRequestedAt?: number;
};

interface Confetti {
  pos: {
    x: number;
    y: number;
  };
  velocity: {
    x: number;
    y: number;
  };
  size: number;
  color: string;
  flicker: number;
  flickerFrequency: number;
  rotation: number;
  lastDrawnAt: number;
  frameCount: number;
}

const CONFETTI_FADEOUT_TIMEOUT = 10000;
const DEFAULT_CONFETTI_SIZE = 10;
const CONFETTI_COLORS = ['#E8BC2C', '#D0049E', '#02CBFE', '#5723FD', '#FE8C27', '#6CB859'];

function ConfettiContainer({ lastRequestedAt }: StateProps) {
  const canvasRef = useRef<HTMLCanvasElement>();
  const confettiRef = useRef<Confetti[]>([]);
  const isRafStartedRef = useRef(false);
  const windowSize = useWindowSize();
  const forceUpdate = useForceUpdate();
  const { isPortrait } = useDeviceScreen();

  const defaultConfettiAmount = isPortrait ? 50 : 100;

  const invokeGenerateConfetti = useLastCallback((w: number, h: number) => {
    generateConfetti(confettiRef, w, h, defaultConfettiAmount);
  });

  const updateCanvas = useLastCallback(() => {
    if (!canvasRef.current || !isRafStartedRef.current) {
      return;
    }
    const canvas = canvasRef.current;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const { width: canvasWidth, height: canvasHeight } = canvas;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const confettiToRemove = new Set<Confetti>([]);
    confettiRef.current.forEach((c, i) => {
      const {
        pos,
        velocity,
        size,
        color,
        flicker,
        flickerFrequency,
        rotation,
        lastDrawnAt,
        frameCount,
      } = c;
      const diff = (Date.now() - lastDrawnAt) / 1000;

      const newPos = {
        x: pos.x + velocity.x * diff,
        y: pos.y + velocity.y * diff,
      };

      const newVelocity = {
        x: velocity.x * 0.98, // Air Resistance
        y: velocity.y += diff * 1000, // Gravity
      };

      const newFlicker = size * Math.abs(Math.sin(frameCount * flickerFrequency));
      const newRotation = 5 * frameCount * flickerFrequency * (Math.PI / 180);

      const newFrameCount = frameCount + 1;
      const newLastDrawnAt = Date.now();

      const shouldRemove = newPos.y > canvasHeight + c.size;
      if (shouldRemove) {
        confettiToRemove.add(c);
        return;
      }

      confettiRef.current[i] = {
        ...c,
        pos: newPos,
        velocity: newVelocity,
        flicker: newFlicker,
        rotation: newRotation,
        lastDrawnAt: newLastDrawnAt,
        frameCount: newFrameCount,
      };
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(
        pos.x,
        pos.y,
        size,
        flicker,
        rotation,
        0,
        2 * Math.PI,
      );
      ctx.fill();
    });

    confettiRef.current = confettiRef.current.filter((c) => !confettiToRemove.has(c));
    if (confettiRef.current.length) {
      requestMeasure(updateCanvas);
    } else {
      isRafStartedRef.current = false;
    }
  });

  useSyncEffect(([prevConfettiTime]) => {
    let hideTimeout: number;
    if (lastRequestedAt && prevConfettiTime !== lastRequestedAt) {
      invokeGenerateConfetti(windowSize.width, windowSize.height);
      hideTimeout = window.setTimeout(forceUpdate, CONFETTI_FADEOUT_TIMEOUT);

      if (!isRafStartedRef.current) {
        isRafStartedRef.current = true;
        requestMeasure(updateCanvas);
      }
    }

    return () => {
      window.clearTimeout(hideTimeout);
    };
  // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps -- Old timeout should be cleared only if new confetti is generated
  }, [lastRequestedAt, forceUpdate, updateCanvas]);

  if (!lastRequestedAt || Date.now() - lastRequestedAt > CONFETTI_FADEOUT_TIMEOUT) {
    return undefined;
  }
  return (
    <div id="Confetti" className={styles.root}>
      <canvas ref={canvasRef} width={windowSize.width} height={windowSize.height} />
    </div>
  );
}

export default memo(withGlobal((global): StateProps => {
  return {
    lastRequestedAt: global.confettiRequestedAt,
  };
})(ConfettiContainer));

function generateConfetti(confettiRef: { current: Confetti[] }, width: number, height: number, amount: number) {
  for (let i = 0; i < amount; i++) {
    const leftSide = i % 2;
    const pos = {
      x: width * (leftSide ? -0.1 : 1.1),
      y: height * 0.75,
    };
    const randomX = Math.random() * width * 1.5;
    const randomY = -height / 2 - Math.random() * height;
    const velocity = {
      x: leftSide ? randomX : randomX * -1,
      y: randomY,
    };

    const randomColor = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    const size = DEFAULT_CONFETTI_SIZE;
    confettiRef.current.push({
      pos,
      size,
      color: randomColor,
      velocity,
      flicker: size,
      flickerFrequency: Math.random() * 0.2,
      rotation: 0,
      lastDrawnAt: Date.now(),
      frameCount: 0,
    });
  }
}

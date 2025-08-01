import { MOBILE_SCREEN_MAX_WIDTH } from '../config';
import { useMediaQuery } from './useMediaQuery';

let isPortrait: boolean | undefined;

export function useDeviceScreen() {
  isPortrait = useMediaQuery(`(max-width: ${MOBILE_SCREEN_MAX_WIDTH - 0.02}px)`);
  const isSmallHeight = useMediaQuery('(max-height: 43.5rem)');

  return {
    isPortrait: Boolean(isPortrait),
    isSmallHeight,
    isLandscape: !isPortrait,
    screenHeight: window.screen.height,
  };
}

export function getIsPortrait() {
  return isPortrait;
}

export function getIsLandscape() {
  return !isPortrait;
}

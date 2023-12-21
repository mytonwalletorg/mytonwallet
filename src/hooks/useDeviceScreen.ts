import { MOBILE_SCREEN_MAX_WIDTH } from '../config';
import { useMediaQuery } from './useMediaQuery';

export function useDeviceScreen() {
  const isPortrait = useMediaQuery(`(max-width: ${MOBILE_SCREEN_MAX_WIDTH - 0.02}px)`);
  const isSmallHeight = useMediaQuery('(max-height: 43.5rem)');

  return {
    isPortrait,
    isSmallHeight,
    isLandscape: !isPortrait,
    screenHeight: window.screen.height,
  };
}

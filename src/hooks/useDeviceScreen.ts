import { MOBILE_SCREEN_MAX_WIDTH } from '../config';
import { useMediaQuery } from './useMediaQuery';

export function useDeviceScreen() {
  const isPortrait = useMediaQuery(`(max-width: ${MOBILE_SCREEN_MAX_WIDTH - 0.02}px)`);

  return {
    isPortrait,
    isLandscape: !isPortrait,
  };
}

import { useState } from '../lib/teact/teact';

import useInterval from './useInterval';

const ONE_SECOND = 1000;
const SHOW_INDICATOR_DELAY_MS = 2 * ONE_SECOND;

export default function useUpdateIndicator(updateStartedAt?: number) {
  const [isUpdating, setIsUpdating] = useState(false);

  useInterval(() => {
    if (!updateStartedAt) {
      setIsUpdating(false);
      return;
    }

    const timeElapsedSinceLastUpdateStarted = Date.now() - updateStartedAt;

    setIsUpdating(timeElapsedSinceLastUpdateStarted > SHOW_INDICATOR_DELAY_MS);
  }, ONE_SECOND, false);

  return isUpdating;
}

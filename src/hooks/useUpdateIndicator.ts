import { useState } from '../lib/teact/teact';
import { getGlobal } from '../global';

import { selectCurrentAccountState } from '../global/selectors';
import useInterval from './useInterval';

const ONE_SECOND = 1000;
const SHOW_INDICATOR_DELAY_MS = 2 * ONE_SECOND;

export default function useUpdateIndicator(updateStartedAtKey: 'balanceUpdateStartedAt' | 'activitiesUpdateStartedAt') {
  const [isUpdating, setIsUpdating] = useState(false);

  useInterval(() => {
    const updateStartedAt = selectCurrentAccountState(getGlobal())?.[updateStartedAtKey];

    if (!updateStartedAt) {
      setIsUpdating(false);
      return;
    }

    const timeElapsedSinceLastUpdateStarted = Date.now() - updateStartedAt;

    setIsUpdating(timeElapsedSinceLastUpdateStarted > SHOW_INDICATOR_DELAY_MS);
  }, ONE_SECOND, false);

  return isUpdating;
}

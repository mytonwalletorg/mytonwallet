import { useEffect } from '../lib/teact/teact';

import { setCancellableTimeout } from '../util/schedulers';
import useLastCallback from './useLastCallback';

function useTimeout(callback: () => void, delay?: number, dependencies: readonly any[] = []) {
  const savedCallback = useLastCallback(callback);

  useEffect(() => {
    if (typeof delay !== 'number') {
      return undefined;
    }

    return setCancellableTimeout(delay, savedCallback);
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [delay, savedCallback, ...dependencies]);
}

export default useTimeout;

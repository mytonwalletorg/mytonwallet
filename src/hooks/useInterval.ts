import { useEffect } from '../lib/teact/teact';

import useLastCallback from './useLastCallback';

function useInterval(callback: NoneToVoidFunction, delay?: number, noFirst = false) {
  const lastCallback = useLastCallback(callback);

  useEffect(() => {
    if (delay === undefined) {
      return undefined;
    }

    const id = setInterval(lastCallback, delay);
    if (!noFirst) lastCallback();

    return () => clearInterval(id);
  }, [delay, lastCallback, noFirst]);
}

export default useInterval;

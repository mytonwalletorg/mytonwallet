import * as langProvider from '../util/langProvider';
import useForceUpdate from './useForceUpdate';
import useSyncEffect from './useSyncEffect';

export type { LangFn } from '../util/langProvider';

function useLang() {
  const forceUpdate = useForceUpdate();

  useSyncEffect(() => {
    return langProvider.addCallback(forceUpdate);
  }, [forceUpdate]);

  return langProvider.getTranslation;
}

export default useLang;

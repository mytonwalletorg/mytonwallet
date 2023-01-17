import * as langProvider from '../util/langProvider';
import useForceUpdate from './useForceUpdate';
import useOnChange from './useOnChange';

export type { LangFn } from '../util/langProvider';

function useLang() {
  const forceUpdate = useForceUpdate();

  useOnChange(() => {
    return langProvider.addCallback(forceUpdate);
  }, [forceUpdate]);

  return langProvider.getTranslation;
}

export default useLang;

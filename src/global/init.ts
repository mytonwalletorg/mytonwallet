import { cloneDeep } from '../util/iteratees';
import { initCache, loadCache } from './cache';
import { addActionHandler } from './index';
import { INITIAL_STATE } from './initialState';
import { selectHasSession } from './selectors';

initCache();

addActionHandler('init', (currentGlobal, actions) => {
  const initial = cloneDeep(INITIAL_STATE);

  const global = loadCache(initial);

  if (selectHasSession(global)) {
    actions.afterSignIn();
  }

  return global;
});

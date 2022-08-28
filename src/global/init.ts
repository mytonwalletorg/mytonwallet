import { addActionHandler } from './index';

import { INITIAL_STATE } from './initialState';
import { initCache, loadCache } from './cache';
import { cloneDeep } from '../util/iteratees';
import { selectHasSession } from './selectors';

initCache();

addActionHandler('init', (_, actions) => {
  const initial = cloneDeep(INITIAL_STATE);
  const cached = loadCache(initial);

  if (selectHasSession(cached)) {
    actions.afterSignIn();
  }

  return loadCache(initial) || initial;
});

import { cloneDeep } from '../util/iteratees';
import { DETACHED_TAB_URL } from '../util/ledger/tab';
import { initCache, loadCache } from './cache';
import { addActionHandler } from './index';
import { INITIAL_STATE } from './initialState';
import { selectHasSession } from './selectors';

initCache();

addActionHandler('init', (_, actions) => {
  const initial = cloneDeep(INITIAL_STATE);

  if (window.location.href.includes(DETACHED_TAB_URL)) {
    actions.initLedgerPage();
    return initial;
  }

  const cached = loadCache(initial);

  const isAuth = selectHasSession(cached);

  if (isAuth) {
    actions.afterSignIn();
  }

  return loadCache(initial) || initial;
});

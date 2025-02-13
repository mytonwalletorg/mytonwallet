import { setGlobal } from '../src/global';
import { INITIAL_STATE } from '../src/global/initialState';
import { cloneDeep } from '../src/util/iteratees';

setGlobal(cloneDeep(INITIAL_STATE));

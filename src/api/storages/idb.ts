import * as idb from 'idb-keyval';
import { Storage } from './types';

export default {
  getItem: idb.get,
  setItem: idb.set,
  removeItem: idb.del,
  clear: idb.clear,
} as Storage;

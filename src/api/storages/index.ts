import { StorageType } from './types';
import idb from './idb';
import localStorage from './localStorage';

export default {
  [StorageType.IndexedDb]: idb,
  [StorageType.LocalStorage]: localStorage,
};

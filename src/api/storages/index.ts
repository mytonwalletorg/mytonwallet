import { StorageType } from './types';

import chromeStorage from './chrome';
import idb from './idb';
import localStorage from './localStorage';

export default {
  [StorageType.IndexedDb]: idb,
  [StorageType.LocalStorage]: localStorage,
  [StorageType.ExtensionLocal]: chromeStorage,
};

import { StorageType } from './types';

import { IS_EXTENSION } from '../../config';
import extensionStorage from './extension';
import idb from './idb';
import localStorage from './localStorage';

export const storage = IS_EXTENSION ? extensionStorage : idb;

export default {
  [StorageType.IndexedDb]: idb,
  [StorageType.LocalStorage]: localStorage,
  [StorageType.ExtensionLocal]: extensionStorage,
};

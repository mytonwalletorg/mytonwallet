import type { OnApiUpdate } from '../types';
import { StorageType } from '../storages/types';

import storages from '../storages';
import * as methods from '.';
import * as dappMethods from '../dappMethods';

export default function init(onUpdate: OnApiUpdate, storageType: StorageType) {
  const storage = storages[storageType];

  methods.initAuth(onUpdate, storage);
  methods.initTransactions(onUpdate, storage);
  methods.initWallet(onUpdate, storage);
  methods.initTokens(onUpdate, storage);
  methods.initNfts(storage);
  methods.initExtension(storage);

  dappMethods.initDappMethods(onUpdate);
}

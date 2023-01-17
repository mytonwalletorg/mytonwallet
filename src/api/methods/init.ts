import type { ApiInitArgs, OnApiUpdate } from '../types';
import { StorageType } from '../storages/types';

import { IS_EXTENSION } from '../environment';
import storages from '../storages';
import * as methods from '.';
import * as dappMethods from '../dappMethods';
import { connectUpdater } from '../common/helpers';

export default function init(onUpdate: OnApiUpdate, args: ApiInitArgs, storageType: StorageType) {
  connectUpdater(onUpdate);

  const storage = storages[storageType];

  methods.initAccounts(onUpdate, storage);
  methods.initPolling(onUpdate, storage, methods.isAccountActive, args);
  void methods.setupPricesPolling();
  methods.initAuth(onUpdate, storage);
  methods.initTransactions(onUpdate, storage);
  void methods.initWallet(onUpdate, storage);
  methods.initNfts(storage);
  void methods.initExtension(storage);
  methods.initStaking(onUpdate, storage);

  if (IS_EXTENSION) {
    dappMethods.initDappMethods(onUpdate);
  }
}

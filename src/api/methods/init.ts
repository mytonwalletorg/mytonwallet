import type { StorageType } from '../storages/types';
import type { ApiInitArgs, OnApiUpdate } from '../types';

import { connectUpdater, startStorageMigration } from '../common/helpers';
import * as dappMethods from '../dappMethods';
import * as legacyDappMethods from '../dappMethods/legacy';
import { IS_EXTENSION } from '../environment';
import storages from '../storages';
import * as tonConnect from '../tonConnect';
import * as methods from '.';

export default function init(onUpdate: OnApiUpdate, args: ApiInitArgs, storageType: StorageType) {
  connectUpdater(onUpdate);

  const storage = storages[storageType];

  methods.initAccounts(onUpdate, storage);
  methods.initPolling(onUpdate, storage, methods.isAccountActive, args);
  methods.initAuth(storage);
  methods.initTransactions(onUpdate, storage);
  void methods.initWallet(onUpdate, storage);
  methods.initNfts(storage);
  methods.initTokens(onUpdate, storage);
  methods.initStaking(onUpdate, storage);

  if (IS_EXTENSION) {
    void methods.initExtension(onUpdate, storage);
    methods.initDapps(onUpdate, storage);
    legacyDappMethods.initLegacyDappMethods(onUpdate);
    dappMethods.initDappMethods(onUpdate);
    tonConnect.initTonConnect(onUpdate, storage);
  }

  void startStorageMigration(storage);
}

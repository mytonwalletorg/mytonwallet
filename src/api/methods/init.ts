import type { ApiInitArgs, OnApiUpdate } from '../types';
import { StorageType } from '../storages/types';

import storages from '../storages';
import * as methods from '.';
import * as dappMethods from '../dappMethods';
import { connectUpdater } from './helpers';

export default function init(onUpdate: OnApiUpdate, args: ApiInitArgs, storageType: StorageType) {
  connectUpdater(onUpdate);

  const storage = storages[storageType];

  methods.initAuth(onUpdate, storage);
  methods.initTransactions(onUpdate, storage);
  methods.initWallet(onUpdate, storage, args.newestTxId);
  methods.initTokens(onUpdate, storage);
  methods.initNfts(storage);
  methods.initExtension(storage);

  dappMethods.initDappMethods(onUpdate);
}

import type { ApiInitArgs, OnApiUpdate } from '../types';

import { IS_CAPACITOR } from '../../config';
import { initWindowConnector } from '../../util/capacitorStorageProxy/connector';
import chains from '../chains';
import { connectUpdater, startStorageMigration } from '../common/helpers';
import { setEnvironment } from '../environment';
import { addHooks } from '../hooks';
import * as tonConnect from '../tonConnect';
import * as tonConnectSse from '../tonConnect/sse';
import * as methods from '.';

addHooks({
  onDappDisconnected: tonConnectSse.sendSseDisconnect,
  onDappsChanged: tonConnectSse.resetupSseConnection,
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default async function init(onUpdate: OnApiUpdate, args: ApiInitArgs) {
  connectUpdater(onUpdate);
  const environment = setEnvironment(args);

  if (IS_CAPACITOR) {
    initWindowConnector();
  }

  methods.initAccounts(onUpdate);
  methods.initPolling(onUpdate);
  methods.initTransactions(onUpdate);
  methods.initStaking();
  methods.initSwap(onUpdate);

  if (environment.isDappSupported) {
    methods.initDapps(onUpdate);
    tonConnect.initTonConnect(onUpdate);
  }

  if (environment.isSseSupported) {
    tonConnectSse.initSse(onUpdate);
  }

  await startStorageMigration(onUpdate, chains.ton);

  if (environment.isSseSupported) {
    void tonConnectSse.resetupSseConnection();
  }
}

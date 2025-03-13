import type { ApiInitArgs, OnApiUpdate } from '../types';

import { IS_EXTENSION } from '../../config';
import { initWindowConnector } from '../../util/windowProvider/connector';
import chains from '../chains';
import { callBackendGet } from '../common/backend';
import { connectUpdater, startStorageMigration } from '../common/helpers';
import { setEnvironment } from '../environment';
import { addHooks } from '../hooks';
import { storage } from '../storages';
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

  if (!IS_EXTENSION) {
    initWindowConnector();
  }

  methods.initAccounts(onUpdate);
  void methods.initPolling(onUpdate);
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

  void saveReferrer(args);
}

async function saveReferrer(args: ApiInitArgs) {
  let referrer = await storage.getItem('referrer');

  if (referrer !== undefined) return;

  if (args.referrer) {
    referrer = args.referrer;
  } else {
    ({ referrer } = await callBackendGet<{ referrer?: string }>('/referrer/get'));
  }

  // An empty string means no referrer
  await storage.setItem('referrer', referrer ?? '');
}

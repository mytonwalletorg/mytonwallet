import type { ApiInitArgs, OnApiUpdate } from '../types';

import { IS_SSE_SUPPORTED } from '../../config';
import { connectUpdater, startStorageMigration } from '../common/helpers';
import { IS_DAPP_SUPPORTED } from '../environment';
import * as tonConnect from '../tonConnect';
import { resetupSseConnection, sendSseDisconnect } from '../tonConnect/sse';
import * as methods from '.';

import { addHooks } from '../hooks';

addHooks({
  onDappDisconnected: sendSseDisconnect,
  onDappsChanged: resetupSseConnection,
});

export default async function init(onUpdate: OnApiUpdate, args: ApiInitArgs) {
  connectUpdater(onUpdate);

  methods.initPolling(onUpdate, methods.isAccountActive, args);
  methods.initTransactions(onUpdate);
  void methods.initWallet(onUpdate);
  methods.initStaking(onUpdate);

  if (IS_DAPP_SUPPORTED) {
    methods.initDapps(onUpdate);
    tonConnect.initTonConnect(onUpdate);
  }

  await startStorageMigration();

  if (IS_SSE_SUPPORTED) {
    void resetupSseConnection();
  }
}

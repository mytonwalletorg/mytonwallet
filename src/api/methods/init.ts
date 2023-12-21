import type { ApiInitArgs, OnApiUpdate } from '../types';

import { IS_DAPP_SUPPORTED, IS_SSE_SUPPORTED } from '../../config';
import { connectUpdater, startStorageMigration } from '../common/helpers';
import { addHooks } from '../hooks';
import * as tonConnect from '../tonConnect';
import { resetupSseConnection, sendSseDisconnect } from '../tonConnect/sse';
import * as methods from '.';

addHooks({
  onDappDisconnected: sendSseDisconnect,
  onDappsChanged: resetupSseConnection,
  onSwapCreated: methods.setupSwapPolling,
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default async function init(onUpdate: OnApiUpdate, args: ApiInitArgs) {
  connectUpdater(onUpdate);

  methods.initPolling(onUpdate, methods.isAccountActive);
  methods.initTransactions(onUpdate);
  methods.initStaking();
  methods.initSwap(onUpdate);
  methods.initNfts(onUpdate);

  if (IS_DAPP_SUPPORTED) {
    methods.initDapps(onUpdate);
    tonConnect.initTonConnect(onUpdate);
  }

  await startStorageMigration(onUpdate);

  if (IS_SSE_SUPPORTED) {
    void resetupSseConnection();
  }
}

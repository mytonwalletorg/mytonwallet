import type { ApiInitArgs, ApiUpdate, OnApiUpdate } from '../types';

import { IS_SSE_SUPPORTED } from '../../config';
import { connectUpdater, startStorageMigration } from '../common/helpers';
import * as dappMethods from '../dappMethods';
import * as legacyDappMethods from '../dappMethods/legacy';
import { IS_DAPP_SUPPORTED, IS_EXTENSION } from '../environment';
import * as tonConnect from '../tonConnect';
import { resetupSseConnection, sendSseDisconnect } from '../tonConnect/sse';
import * as methods from '.';

export default async function init(_onUpdate: OnApiUpdate, args: ApiInitArgs) {
  const onUpdate: OnApiUpdate = (update: ApiUpdate) => _onUpdate(update);

  connectUpdater(onUpdate);

  methods.initPolling(onUpdate, methods.isAccountActive, args);
  methods.initTransactions(onUpdate);
  void methods.initWallet(onUpdate);
  methods.initStaking(onUpdate);

  if (IS_DAPP_SUPPORTED) {
    const onDappChanged = IS_SSE_SUPPORTED ? resetupSseConnection : undefined;
    const onDappDisconnected = IS_SSE_SUPPORTED ? sendSseDisconnect : undefined;
    methods.initDapps(onUpdate, onDappChanged, onDappDisconnected);
    tonConnect.initTonConnect(onUpdate);
  }
  if (IS_EXTENSION) {
    void methods.initExtension(onUpdate);
    legacyDappMethods.initLegacyDappMethods(onUpdate);
    dappMethods.initDappMethods(onUpdate);
  }

  await startStorageMigration();

  if (IS_SSE_SUPPORTED) {
    void resetupSseConnection();
  }
}

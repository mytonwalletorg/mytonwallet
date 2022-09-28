import type { OnApiDappUpdate } from '../../types/dappUpdates';
import { DappMethodArgs, DappMethods } from '../../dappMethods/types';

import { CONTENT_SCRIPT_PORT, PROVIDER_CHANNEL } from '../../../extension/config';

import * as dappApi from '../../dappMethods';
import { createExtensionInterface } from '../../../util/createPostMessageInterface';

const ALLOWED_METHODS = new Set([
  'getBalance', 'requestAccounts', 'requestWallets', 'sendTransaction', 'rawSign', 'flushMemoryCache',
]);

createExtensionInterface(CONTENT_SCRIPT_PORT, (name: string, ...args: any[]) => {
  if (name === 'init') {
    return dappApi.connectDapp(args[0] as OnApiDappUpdate);
  }

  if (!ALLOWED_METHODS.has(name)) {
    throw new Error('Method not allowed');
  }

  const method = dappApi[name as keyof DappMethods];
  // @ts-ignore
  return method(...args as DappMethodArgs<keyof DappMethods>);
}, PROVIDER_CHANNEL, (onUpdate: OnApiDappUpdate) => {
  dappApi.disconnectDapp(onUpdate);
}, true);

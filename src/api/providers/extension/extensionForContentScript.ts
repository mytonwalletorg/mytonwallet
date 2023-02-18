import type { OnApiDappUpdate } from '../../types/dappUpdates';
import {
  DappMethodArgs,
  DappMethods,
  LegacyDappMethodArgs,
  LegacyDappMethods,
} from '../../dappMethods/types';
import { TonConnectMethodArgs, TonConnectMethods } from '../../tonConnect/types/misc';

import { CONTENT_SCRIPT_PORT, PROVIDER_CHANNEL } from '../../../extension/config';

import * as dappApi from '../../dappMethods';
import * as legacyDappApi from '../../dappMethods/legacy';
import * as tonConnectApi from '../../tonConnect';
import { createExtensionInterface } from '../../../util/createPostMessageInterface';

const ALLOWED_METHODS = new Set([
  'ton_getBalance',
  'ton_requestAccounts',
  'ton_requestWallets',
  'ton_sendTransaction',
  'ton_rawSign',
  'flushMemoryCache',
  'tonConnect_connect',
  'tonConnect_reconnect',
  'tonConnect_disconnect',
  'tonConnect_sendTransaction',
  'tonConnect_deactivate',
]);

createExtensionInterface(CONTENT_SCRIPT_PORT, (
  name: string, origin?: string, ...args: any[]
) => {
  if (name === 'init') {
    return dappApi.connectDapp(args[0] as OnApiDappUpdate, legacyDappApi.onDappSendUpdates);
  }

  if (!ALLOWED_METHODS.has(name)) {
    throw new Error('Method not allowed');
  }

  if (name.startsWith('ton_')) {
    name = name.replace('ton_', '');
    const method = legacyDappApi[name as keyof LegacyDappMethods];
    // @ts-ignore
    return method(...args as keyof LegacyDappMethodArgs<keyof LegacyDappMethods>);
  }

  if (name.startsWith('tonConnect_')) {
    const request = { origin };
    name = name.replace('tonConnect_', '');
    const method = tonConnectApi[name as keyof TonConnectMethods];
    // @ts-ignore
    return method(...[request].concat(args) as TonConnectMethodArgs<keyof TonConnectMethods>);
  }

  const method = dappApi[name as keyof DappMethods];
  // @ts-ignore
  return method(...args as DappMethodArgs<keyof DappMethods>);
}, PROVIDER_CHANNEL, (onUpdate: OnApiDappUpdate) => {
  dappApi.deactivateDapp(onUpdate);
}, true);
